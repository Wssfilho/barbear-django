# Recomendações de Evolução e Prontidão para Produção — `barbear-django`

Este documento apresenta uma análise técnica e de produto voltada à preparação do sistema **`barbear-django`** para **uso real em produção**. Todas as recomendações abaixo foram elaboradas a partir da inspeção direta do código-fonte atual (backend Django/DRF e frontend React/Vite), **sem implementação de novas funcionalidades** nesta entrega.

---

## 1. Estado Atual Verificado (Baseline)

Ao contrário do que consta em documentos anteriores desatualizados (`README.md` e `BRIEFING.md`), o código-fonte atual na árvore de trabalho já implementa o fluxo central do MVP com separação de papéis e interface web completa:

- **Stack verificada**:
  - **Backend (`barber/`)**: `Django 5.2`, `djangorestframework 3.16.0`, `djangorestframework_simplejwt 5.5.0`, `django-cors-headers 4.7.0`, `gunicorn 21.2.0` (`requirements.txt`). Banco configurado para PostgreSQL 18 via Docker (`compose.yaml`, banco `Tramontina` na porta `5433`) e SQLite local via `USE_SQLITE=1` (`barber/barber/settings.py:90-107`).
  - **Frontend (`frontend/`)**: SPA em **React 19 + Vite 7** (`frontend/package.json`), estilizada com CSS puro e ícones `lucide-react`, comunicando-se via `VITE_API_URL` ou proxy `/django` (`frontend/src/api.js`, `frontend/vite.config.js`).
  - **Qualidade de base**: `manage.py check` sem pendências e **79 testes automatizados passando** (`Usuario/tests.py`: 19, `service/test_catalog.py`: 9, `scheduling/test_role_access.py`: 51).
- **Recursos já implementados no código atual (não listados como faltantes)**:
  - **Autenticação JWT por perfil (`barber/Usuario/auth.py`, `barber/barber/urls.py:13-16`)**: `PerfilTokenObtainPairView`, `ClienteTokenObtainPairView` (`/api/token/cliente/`), `BarbeiroTokenObtainPairView` (`/api/token/barbeiro/`) e `TokenRefreshView` (`/api/token/refresh/`), além do comando CLI `criar_barbeiro` (`barber/Usuario/management/commands/criar_barbeiro.py`).
  - **Permissões no banco e isolamento por dono (`barber/Usuario/permissions.py`)**: `TemPerfil`, `IsBarbeiro`, `IsCliente` e `get_perfil` consultam o banco em vez de confiar apenas no claim do token; `BarbshopModelViewSet` e `ServiceModelViewSet` restringem escrita ao proprietário (`_da_conta`, `_do_barbeiro`, `ServiceWriteSerializer.validate_Barbearia`).
  - **Agendamento por cliente com trava concorrente e disponibilidade por barbeiro (`barber/scheduling/views.py`, `barber/scheduling/availability.py`)**: `POST /scheduling/` exige `IsCliente`, utiliza `transaction.atomic()` + `select_for_update()` no barbeiro e `UniqueConstraint` (`scheduling_unique_barbeiro_horario`); `available_times` calcula grade de 20 minutos dentro do expediente e filtra horários passados.
  - **Frontend SPA funcional (`frontend/src/App.jsx`, `Dashboard.jsx`, `Dialogs.jsx`)**: rotas hash para visitante/cliente (`#visao-geral`, `#agenda`, `#barbearias`, `#servicos`, `#conta`) e barbeiro (`#painel`, `#agenda`, `#clientes`, `#conta`), atualização automática de JWT em `sessionStorage`, criação/edição de barbearias e serviços, criação e cancelamento de agendamentos.

Apesar dessa base sólida para MVP local, **existem lacunas críticas de segurança, modelagem de domínio, operação financeira, observabilidade e experiência de uso** que impedem o lançamento seguro em produção.

---

## 2. Matriz de Priorização (P0, P1, P2)

| ID | Recomendação | Prioridade | Área | Dependências | Impacto em Produção |
|---|---|---|---|---|---|
| **REC-01** | Hardening de `settings.py`, segredos, HTTPS e banco (`check --deploy`) | **P0** | Infra / Segurança | Nenhuma | Elimina exposição de `SECRET_KEY`, `DEBUG=True`, credenciais fixas e tráfego inseguro |
| **REC-02** | Política JWT segura, `token_blacklist` e logout real | **P0** | Backend / Segurança | REC-01 | Reduz janela de token roubado de 90 dias para minutos e permite revogação |
| **REC-03** | Hardening do DRF (throttling, paginação, renderers) e agregação SQL | **P0** | Backend / Perf. | Nenhuma | Protege login/cadastro contra força bruta e evita respostas sem limite |
| **REC-04** | Observabilidade (`/health/`, `LOGGING`), erros 404/500 e entrega de estáticos/SPA | **P0** | Infra / Backend | REC-01 | Viabiliza deploy real com Gunicorn, monitoramento e diagnóstico de falhas |
| **REC-05** | Ciclo de vida de agendamento (`status`), cancelamento lógico e reagendamento | **P0** | Backend / Frontend | Nenhuma | Preserva histórico operacional, habilita no-show/conclusão e reagendamento |
| **REC-06** | Snapshot financeiro (`preco_registrado`), arquivamento e confirmação de exclusão | **P0** | Backend / Frontend | REC-05 | Impede perda de histórico por `CASCADE` e corrupção retroativa de receita |
| **REC-07** | Recuperação/troca de senha, validação real de CPF/e-mail e edição de perfil na UI | **P0** | Backend / Frontend | REC-09 (e-mail) | Desbloqueia autoatendimento de contas e evita cadastros inválidos/duplicados |
| **REC-08** | Agendamento manual / balcão (walk-in) pelo barbeiro | **P0** | Backend / Frontend | REC-05 | Permite registrar clientes presenciais/WhatsApp sem exigir login do cliente |
| **REC-09** | Notificações transacionais e lembretes automáticos (E-mail / WhatsApp / SMS) | **P0** | Backend / Negócio | REC-05 | Reduz faltas (*no-show*) e confirma reservas automaticamente |
| **REC-10** | Duração variável por serviço (`duracao_minutos`) e bloqueio por intervalo | **P1** | Backend / Frontend | REC-05 | Evita conflito de agenda em serviços longos (combo cabelo + barba) |
| **REC-11** | Equipe multi-barbeiro desacoplada de `BarberShop.Dono` | **P1** | Backend / Frontend | REC-10 | Permite barbearias com múltiplos profissionais, agendas e comissões |
| **REC-12** | Calendário semanal por dia útil, intervalo de almoço, feriados e bloqueios | **P1** | Backend / Frontend | REC-11 (opcional) | Suporta folgas, domingos fechados, pausas e bloqueios pontuais |
| **REC-13** | Busca/filtros, histórico de cliente, filtro multi-loja do barbeiro e fotos | **P1** | Frontend / Backend | REC-03, REC-04 | Melhora descoberta de barbearias/serviços e operação diária do barbeiro |
| **REC-14** | Painel financeiro/operacional por período e exportação (CSV/PDF) | **P1** | Backend / Frontend | REC-05, REC-06 | Entrega visão gerencial real (receita realizada, ocupação, no-show, comissões) |
| **REC-15** | CI/CD com PostgreSQL 18, backups automáticos, linters e testes frontend/E2E | **P1** | Infra / QA | REC-01 | Garante paridade dev/prod e previne regressões em deploys contínuos |
| **REC-16** | Pagamentos online, sinal anti-no-show (Pix/Cartão) e checkout de caixa | **P2** | Negócio / Backend | REC-05, REC-06, REC-09 | Monetização direta, redução drástica de faltas e controle de caixa |
| **REC-17** | Fidelidade, pacotes de serviços, assinaturas mensais e cupons | **P2** | Negócio / Fullstack | REC-16 (assinaturas) | Aumenta recorrência e ticket médio dos estabelecimentos |
| **REC-18** | Avaliações verificadas, favoritos e portfólio de cortes | **P2** | Negócio / Fullstack | REC-05, REC-13 | Aumenta confiança e conversão para novos clientes |
| **REC-19** | Conformidade LGPD, exportação `.ics`, lista de espera e OpenAPI (`drf-yasg`) | **P2** | Segurança / Produto | REC-05, REC-09 | Adequação legal (LGPD), conveniência e documentação viva de API |

---

## 3. Recomendações Detalhadas

### P0 — Lançamento em Produção (Segurança, Confiabilidade e Operação Essencial)

#### REC-01 — Hardening de Configurações Django, Segredos, HTTPS e Banco de Dados
- **O que existe hoje (Evidência no código)**:
  - `barber/barber/settings.py:25-30` mantém `SECRET_KEY` insegura hardcoded (`django-insecure-...`), `DEBUG = True` e `ALLOWED_HOSTS = []`.
  - `barber/barber/settings.py:98-107` fixa credenciais de PostgreSQL (`NAME='Tramontina'`, `USER='postgres'`, `PASSWORD='123'`, `HOST='localhost'`).
  - `barber/barber/settings.py:35-50` inclui `'django_extensions'` (ferramenta de desenvolvimento) e `'rest_framework.authtoken'` (não utilizado pelas views JWT); `requirements.txt:15` contém o pacote obsoleto `rest-framework-simplejwt==0.0.2`.
  - A execução de `manage.py check --deploy` aponta **7 avisos de segurança**: `security.W004` (HSTS), `security.W008` (`SECURE_SSL_REDIRECT`), `security.W009` (`SECRET_KEY`), `security.W012` (`SESSION_COOKIE_SECURE`), `security.W016` (`CSRF_COOKIE_SECURE`), `security.W018` (`DEBUG=True`) e `security.W020` (`ALLOWED_HOSTS` vazio).
- **Lacuna / Risco em produção**:
  - Qualquer deploy com as configurações atuais expõe stack traces completos (`DEBUG=True`), permite assinatura forjada de sessões/JWT caso a `SECRET_KEY` do repositório vaze e deixa cookies de sessão/CSRF e tráfego do `/admin/` vulneráveis a interceptação e *host-header injection*.
- **Escopo recomendado**:
  - Externalizar todas as variáveis sensíveis para ambiente (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL` ou variáveis `POSTGRES_*`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`), falhando na inicialização se `SECRET_KEY` ou `ALLOWED_HOSTS` estiverem ausentes com `DEBUG=False`.
  - Configurar `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` e `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` quando atrás de proxy reverso.
  - Separar dependências/settings de dev e produção (`django_extensions` restrito a dev), remover `rest_framework.authtoken` não usado e limpar `rest-framework-simplejwt==0.0.2` de `requirements.txt`.
- **Critérios de aceite e dependências**:
  - Sem dependências prévias.
  - `manage.py check --deploy` com `DEBUG=False` retorna **0 warnings** e **0 erros**.
  - Nenhum segredo ou senha de banco permanece versionado fora de `.env.example`.

---

#### REC-02 — Política de Sessão JWT, `token_blacklist` e Logout Real
- **O que existe hoje (Evidência no código)**:
  - `barber/barber/settings.py:151-164` define `'ACCESS_TOKEN_LIFETIME': timedelta(days=90)` (90 dias!) e `'REFRESH_TOKEN_LIFETIME': timedelta(days=1)` (menor que o access token), com `'ROTATE_REFRESH_TOKENS': False` e `'BLACKLIST_AFTER_ROTATION': True`.
  - `barber/barber/settings.py:35-50` **não inclui** `'rest_framework_simplejwt.token_blacklist'` em `INSTALLED_APPS`.
  - `barber/barber/urls.py:13-16` não possui rota de logout (`/api/token/logout/`); no frontend, `logout()` (`frontend/src/App.jsx:145-150`) apenas remove os tokens do `sessionStorage`.
- **Lacuna / Risco em produção**:
  - Um *access token* válido por 90 dias permite que qualquer credencial vazada (dispositivo compartilhado, XSS ou rede comprometida) acesse e cancele agendamentos por três meses sem possibilidade de revogação, pois a *blacklist* está inativa. Além disso, o fluxo de refresh em `frontend/src/api.js:82-95` quase nunca é exercitado antes do refresh expirar em 1 dia.
- **Escopo recomendado**:
  - Ajustar `ACCESS_TOKEN_LIFETIME` para 15–30 minutos e `REFRESH_TOKEN_LIFETIME` para 7–14 dias, com `ROTATE_REFRESH_TOKENS = True` e `BLACKLIST_AFTER_ROTATION = True`.
  - Registrar `'rest_framework_simplejwt.token_blacklist'` em `INSTALLED_APPS` e aplicar suas migrações.
  - Criar endpoint autenticado `POST /api/token/logout/` para colocar o `refresh` token na blacklist e integrá-lo ao `logout()` em `frontend/src/App.jsx` e `frontend/src/api.js`.
- **Critérios de aceite e dependências**:
  - Depende de REC-01 (para `SIGNING_KEY` seguro em produção).
  - Após `POST /api/token/logout/`, tentativas subsequentes em `/api/token/refresh/` com o mesmo refresh token retornam HTTP 401.
  - Renovação automática de token expirado no frontend validada por teste automatizado.

---

#### REC-03 — Hardening Global do DRF (Throttling, Paginação, Renderers) e Otimização de Consultas
- **O que existe hoje (Evidência no código)**:
  - `barber/barber/settings.py` não define dicionário `REST_FRAMEWORK`: não há `DEFAULT_THROTTLE_CLASSES`/`DEFAULT_THROTTLE_RATES`, não há `DEFAULT_PAGINATION_CLASS`, e `BrowsableAPIRenderer` permanece habilitado por padrão.
  - Todos os endpoints de listagem (`UsuarioModelViewSet.list` em `Usuario/views.py:57-82`, `BarbshopModelViewSet.list` em `barbshop/views.py:24-27`, `ServiceModelViewSet.list` em `service/views.py:26-35`, `schedulingModelViewSet.list` em `scheduling/views.py:56-64`) retornam todos os registros sem paginação.
  - `UsuarioModelViewSet.list` (`Usuario/views.py:62-70`) busca **todos** os agendamentos do barbeiro no Python (`Scheduling.objects.filter(barbeiro=barbeiro)`) e calcula `totais` e `proximos` em laço Python.
- **Lacuna / Risco em produção**:
  - Sem rate limiting, `/api/token/*`, `POST /usuario/` e `POST /scheduling/` ficam expostos a força bruta de senhas, criação em massa de contas e esgotamento de horários por bots.
  - Sem paginação e com agregação em memória, barbearias com meses de histórico sofrerão degradação de latência, alto uso de memória e risco de timeout no Gunicorn.
- **Escopo recomendado**:
  - Configurar `REST_FRAMEWORK` em `settings.py` com `DEFAULT_RENDERER_CLASSES = ('rest_framework.renderers.JSONRenderer',)` quando `DEBUG=False`, `DEFAULT_THROTTLE_CLASSES` (`AnonRateThrottle`, `UserRateThrottle`, `ScopedRateThrottle` específico para login/cadastro/agendamento) e paginação padronizada (com atualização coordenada dos consumidores em `frontend/src/api.js` ou suporte a `page`/`page_size`).
  - Substituir o loop em memória de `UsuarioModelViewSet.list` por agregações ORM (`Count`, `Min` filtrado com `Q(data_agendamento__gt=...) | Q(data_agendamento=..., horario_agendamento__gte=...)`) ou paginação direta com `annotate`.
- **Critérios de aceite e dependências**:
  - Sem dependências prévias.
  - Testes automatizados comprovam retorno HTTP 429 ao exceder limite em `/api/token/` e `/usuario/`, resposta JSON sem HTML do Browsable API com `DEBUG=False`, e contagem fixa de queries em `GET /usuario/`.

---

#### REC-04 — Observabilidade, Healthcheck, Páginas de Erro (404/500) e Pipeline de Estáticos/SPA
- **O que existe hoje (Evidência no código)**:
  - `barber/barber/urls.py:17-20` inclui quatro roteadores DRF no prefixo raiz `''`, fazendo com que `GET /` exiba apenas o `Urouter` e não haja rota de saúde (`/health/`).
  - `barber/barber/settings.py:69-82,144` possui `TEMPLATES[0]['DIRS'] = []`, apenas `STATIC_URL = 'static/'`, sem `STATIC_ROOT`, sem `WhiteNoiseMiddleware`, sem configuração `LOGGING` e sem `handler404`/`handler500` ou `EXCEPTION_HANDLER` customizado do DRF.
  - `frontend/dist/` gera o build estático da SPA, mas não existe configuração de entrega integrada com Gunicorn (`requirements.txt:8`) ou proxy reverso em `compose.yaml`.
- **Lacuna / Risco em produção**:
  - Em produção (`DEBUG=False`), o Django Admin perde CSS/JS sem `STATIC_ROOT` + servidor de estáticos, erros 500 não produzem logs estruturados para investigação, orquestradores/load balancers não têm `/health/` para verificar conexão ao PostgreSQL, e a SPA compilada (`frontend/dist/`) não possui roteamento documentado/automatizado em produção.
- **Escopo recomendado**:
  - Consolidar rotas da API (ex.: sob `/api/` ou mantendo compatibilidade de contrato), adicionar endpoint `GET /health/` (ou `/healthz/`) verificando acesso ao banco (`SELECT 1`), configurar `LOGGING` estruturado (nível via env var, logs de erro HTTP e exceções) e definir `handler404`/`handler500` em JSON para rotas de API + `EXCEPTION_HANDLER` padronizado no DRF.
  - Definir pipeline de entrega estática: `STATIC_ROOT` + `collectstatic` + `WhiteNoise` para `/admin/` (e opcionalmente SPA) ou container Nginx em `compose.yaml` servindo `frontend/dist/` com fallback SPA e proxy `/api/` / `/admin/` para o Gunicorn.
- **Critérios de aceite e dependências**:
  - Depende de REC-01.
  - `GET /health/` retorna HTTP 200 com banco acessível e HTTP 503 se indisponível.
  - `manage.py collectstatic --noinput` executa sem erros e `/admin/` carrega estilos corretamente com `DEBUG=False`.

---

#### REC-05 — Ciclo de Vida de Agendamentos (`status`), Cancelamento Lógico e Reagendamento
- **O que existe hoje (Evidência no código)**:
  - `barber/scheduling/models.py:16-32` não possui campo `status`, timestamps (`created_at`, `updated_at`) nem metadados de cancelamento; mantém `UniqueConstraint(fields=['barbeiro', 'data_agendamento', 'horario_agendamento'])`.
  - `barber/scheduling/views.py:128-130` implementa `destroy()` como `self.get_object().delete()`, removendo permanentemente o registro do banco. Não há ação `partial_update`/`PATCH` para reagendar ou atualizar status.
- **Lacuna / Risco em produção**:
  - Excluir fisicamente agendamentos destrói a trilha de auditoria, impede medir taxa de cancelamento e *no-show* (não comparecimento), impede saber quem cancelou (cliente ou barbeiro) e obriga o usuário a cancelar e refazer do zero para mudar horário.
- **Escopo recomendado**:
  - Adicionar em `Scheduling`: `status` (`CONFIRMADO`, `EM_ATENDIMENTO`, `CONCLUIDO`, `CANCELADO_CLIENTE`, `CANCELADO_BARBEIRO`, `NAO_COMPARECEU`), `cancelado_por`, `cancelado_em`, `motivo_cancelamento`, `created_at` e `updated_at`.
  - Substituir a `UniqueConstraint` atual por **constraint parcial condicional** (`condition=Q(status__in=['CONFIRMADO', 'EM_ATENDIMENTO'])`) e filtrar apenas status ativos em `scheduling/availability.py:32-34`, liberando automaticamente horários cancelados sem apagar o registro.
  - Converter `DELETE /scheduling/{id}/` (ou adicionar ação `POST /scheduling/{id}/cancel/`) em cancelamento lógico com regra de antecedência mínima configurável por barbearia (ex.: cliente só cancela até 2h antes; barbeiro pode cancelar/marcar `NAO_COMPARECEU` ou `CONCLUIDO`).
  - Implementar `PATCH /scheduling/{id}/` (reagendamento atômico com `select_for_update()`) e controles correspondentes em `DetailsDialog` (`frontend/src/Dialogs.jsx:175-210`) e na agenda do barbeiro (`Dashboard.jsx`).
- **Critérios de aceite e dependências**:
  - Sem dependências prévias (recomendação fundacional para REC-06, REC-08, REC-09, REC-14).
  - Cancelar um agendamento mantém o registro consultável no histórico com `status=CANCELADO_*` e torna o horário imediatamente disponível em `GET /scheduling/available_times/`.
  - Tentativa de reagendamento para horário ocupado retorna HTTP 400 sem perder o horário original em caso de falha.

---

#### REC-06 — Snapshot Financeiro (`preco_registrado`), Arquivamento Lógico e Confirmação de Exclusão
- **O que existe hoje (Evidência no código)**:
  - `barber/scheduling/models.py:17-21` usa `on_delete=models.CASCADE` em `cliente`, `barbeiro` e `servico`, e `barber/service/models.py:8` usa `on_delete=models.CASCADE` em `Barbearia`, sem persistir o preço nem o nome do serviço no momento da reserva.
  - `frontend/src/Dashboard.jsx:28-35` calcula `Receita prevista` e `Ticket médio` somando `item.service.price` (o preço **atual** do catálogo).
  - `frontend/src/Dashboard.jsx:135-143,237` chama `api.deleteService(item.id)` diretamente no clique da lixeira, sem modal de confirmação; e não há opção na UI para desativar/excluir uma barbearia (embora `DELETE /barbshop/{id}/` exista em `barbshop/views.py:63-68`).
- **Lacuna / Risco em produção**:
  - Reajustar o preço de um serviço altera retroativamente o faturamento de atendimentos passados e já reservados. Pior: excluir um serviço ou barbearia dispara `CASCADE`, apagando silenciosamente todos os agendamentos históricos (e futuros!) de clientes sem aviso.
- **Escopo recomendado**:
  - Adicionar em `Scheduling` os campos imutáveis de snapshot (`preco_registrado`, `servico_nome_snapshot` e, futuramente, `duracao_registrada`), preenchidos atomicamente em `create()`, usando `on_delete=models.PROTECT` nas FKs críticas.
  - Adicionar flag `ativo = models.BooleanField(default=True)` (soft-archive) em `BarberShop` e `Service`: registros com agendamentos vinculados são arquivados (`ativo=False`) em vez de excluídos, ocultando-os de novas reservas públicas sem quebrar o histórico.
  - No frontend, atualizar `Dashboard.jsx` para exibir o valor congelado da reserva e adicionar diálogo de confirmação antes de arquivar/excluir serviços ou barbearias.
- **Critérios de aceite e dependências**:
  - Depende de REC-05.
  - Alterar `Service.Preco` após a criação de um agendamento não altera o valor retornado pelo agendamento existente nem os indicadores financeiros históricos.
  - Excluir/desativar um serviço com agendamentos vinculados não apaga agendamentos passados nem futuros.

---

#### REC-07 — Recuperação/Troca de Senha, Validação de CPF/E-mail Único e Edição de Perfil na UI
- **O que existe hoje (Evidência no código)**:
  - `barber/Usuario/models.py:18-20` define `Telefone` com `default=00000000000` (literal inteiro em `CharField`, gravado como `'0'`) e `max_length=11` (enquanto `BarberShop.Telefone` em `barbshop/models.py:10` usa `max_length=15`), além de `cpf` sem `unique=True`.
  - `barber/Usuario/serializer.py:53-114` valida apenas `\d{11}` para `cpf` (aceita `00000000000` ou `11111111111` sem validar dígitos verificadores), não verifica unicidade de `email` ou `cpf` no cadastro nem na atualização (`PerfilUpdateSerializer`).
  - Não existem endpoints de troca de senha autenticada nem fluxo de "esqueci minha senha".
  - O backend já expõe `PATCH /usuario/me/` (`barber/Usuario/views.py:95-103`), mas a tela `Account` (`frontend/src/Dashboard.jsx:353-371`) é somente leitura e não oferece edição de perfil.
- **Lacuna / Risco em produção**:
  - Usuários que esquecem a senha não conseguem recuperar a conta sem intervenção manual no `/admin/`; múltiplos cadastros com mesmo e-mail ou CPF fictício inviabilizam recuperação de conta, prevenção de fraude/no-show e emissão fiscal; e clientes/barbeiros não conseguem atualizar telefone ou e-mail pela interface web.
- **Escopo recomendado**:
  - Adicionar validação matemática dos dígitos verificadores de CPF (rejeitando sequências repetidas como `00000000000`) e unicidade case-insensitive de `email` e `cpf` (avaliando tornar CPF opcional no cadastro público caso a LGPD/conversão recomende exigir apenas no pagamento).
  - Padronizar `Telefone` (`default=''` em `Usuario.models`, `max_length=15` ou normalização DDD+número).
  - Criar endpoints `POST /usuario/me/password/` (troca autenticada exigindo senha atual) e fluxo de redefinição via token por e-mail (`/api/auth/password-reset/` e `confirm/`).
  - Conectar a tela `Account` (`frontend/src/Dashboard.jsx`) e `api.js` ao endpoint já existente `PATCH /usuario/me/` e à troca de senha.
- **Critérios de aceite e dependências**:
  - Fluxo de reset de senha depende de REC-09 (configuração `EMAIL_*`).
  - CPFs inválidos (ex.: `11111111111`) e e-mails já cadastrados retornam HTTP 400 claro.
  - Usuário consegue editar nome, e-mail e telefone em `#conta` e persistir via `PATCH /usuario/me/`.

---

#### REC-08 — Agendamento Manual / Balcão (Walk-in) pelo Barbeiro
- **O que existe hoje (Evidência no código)**:
  - `barber/scheduling/views.py:42-43,121-122` restringe `POST /scheduling/` a `IsAuthenticated, IsCliente` e força `cliente=get_perfil(request.user)`.
  - No frontend (`frontend/src/App.jsx:202-234` e `Dashboard.jsx:132-245`), o botão "Novo agendamento" e `BookingDialog` ficam indisponíveis ou bloqueados (`restricted = session && role === 'barbeiro'` em `Dialogs.jsx:116`) para barbeiros.
- **Lacuna / Risco em produção**:
  - Na rotina real de uma barbearia, grande parte dos atendimentos chega presencialmente (encaixe/balcão) ou por telefone/WhatsApp. Sem registro rápido pelo barbeiro, a agenda digital fica dessincronizada da cadeira real, gerando conflito de horários para clientes que reservam online.
- **Escopo recomendado**:
  - Permitir que `POST /scheduling/` aceite `IsCliente | IsBarbeiro`: quando acionado pelo barbeiro dono/vinculado à barbearia, aceitar `cliente_id` existente ou dados mínimos de cliente avulso (`cliente_nome_avulso`, `cliente_telefone_avulso`, `origem='balcao'`), validando que o serviço pertence à barbearia do barbeiro e mantendo o lock transacional `select_for_update()`.
  - Habilitar modal de novo agendamento/encaixe diretamente no `#painel` e `#agenda` do barbeiro (`frontend/src/Dashboard.jsx`), com busca rápida entre clientes já atendidos ou preenchimento rápido de nome/telefone.
- **Critérios de aceite e dependências**:
  - Depende de REC-05 (status e origem do agendamento).
  - Barbeiro consegue bloquear/reservar um horário para cliente presencial ou cadastrado, e o horário some imediatamente de `available_times`.
  - Cliente continua impedido de criar reservas em nome de terceiros (HTTP 403/400).

---

#### REC-09 — Notificações Transacionais e Lembretes Automáticos (E-mail / WhatsApp / SMS)
- **O que existe hoje (Evidência no código)**:
  - Não há configurações `EMAIL_*`, provedor de mensageria (WhatsApp/SMS) nem fila de tarefas assíncronas (`Celery`, `Django-Q`, `RQ`) em `barber/barber/settings.py` ou `requirements.txt`.
  - A confirmação de reserva existe apenas como toast efêmero de 4,5s na tela (`frontend/src/Dialogs.jsx:282-288`).
- **Lacuna / Risco em produção**:
  - Sem lembretes automáticos (ex.: 24h e 2h antes) e avisos de cancelamento/reagendamento, a taxa de esquecimento e *no-show* em barbearias é elevada, causando perda direta de receita e falta de confiança do cliente na confirmação da reserva.
- **Escopo recomendado**:
  - Configurar `EMAIL_BACKEND` transacional (SMTP/SES/Resend via env vars) e fila assíncrona (ex.: Celery + Redis ou Django-Q2) com disparo de e-mails para: confirmação de agendamento, cancelamento (pelo cliente ou barbeiro), reagendamento e recuperação de senha.
  - Estruturar interface plugável de canal para lembretes programados (24h e 2h antes do horário) por E-mail e integração opcional com WhatsApp Business API / SMS, com registro de envio idempotente (`NotificacaoEnviada`) e opção de opt-out.
- **Critérios de aceite e dependências**:
  - Depende de REC-05 (status de agendamento para não lembrar horários cancelados).
  - Falha no provedor de e-mail/WhatsApp não impede nem trava a resposta HTTP de `POST /scheduling/` (execução assíncrona com retentativa).

---

### P1 — Operação e Crescimento (Escala de Negócio, Experiência e Qualidade)

#### REC-10 — Duração Variável por Serviço (`duracao_minutos`) e Intervalos Dinâmicos
- **O que existe hoje (Evidência no código)**:
  - `barber/service/models.py:7-14` possui apenas `Barbearia`, `Nome`, `Descricao` e `Preco`, sem campo de duração.
  - `barber/scheduling/models.py:7-13,24` e `barber/scheduling/availability.py:7-37` travam toda reserva em pontos fixos de `SLOT_MINUTES = 20` minutos, verificando apenas igualdade exata de `horario_agendamento`.
- **Lacuna / Risco em produção**:
  - Um serviço de 40 ou 60 minutos (ex.: corte degradê + barba + sobrancelha) ocupa apenas um slot de 20 minutos na tabela, permitindo que outro cliente agende 20 minutos depois e gerando atraso em cascata na cadeira.
- **Escopo recomendado**:
  - Adicionar `duracao_minutos = models.PositiveIntegerField(default=20)` (ex.: múltiplos de 10, 15 ou 20 min, mais opcional `intervalo_preparacao_minutos`) em `Service`, e persistir `duracao_registrada` em `Scheduling`.
  - Refatorar `scheduling/availability.py` e a validação atômica de `POST /scheduling/` / `PATCH /scheduling/{id}/` para checar **sobreposição de intervalos** (`inicio_novo < fim_existente and fim_novo > inicio_existente`), retornando em `GET /scheduling/available_times/?servico=...` apenas inícios que comportem a duração integral do serviço selecionado antes do fechamento ou próximo atendimento.
  - Atualizar `ServiceDialog` (`frontend/src/Dialogs.jsx:249-280`) e cards de serviço (`Dashboard.jsx`) para exibir e editar a duração.
- **Critérios de aceite e dependências**:
  - Depende de REC-05.
  - Serviço de 60 minutos às 10:00 impede reservas às 10:00, 10:20 e 10:40, mantendo 11:00 disponível.

---

#### REC-11 — Equipe Multi-Barbeiro Desacoplada de `BarberShop.Dono`
- **O que existe hoje (Evidência no código)**:
  - `barber/barbshop/models.py:7` associa cada loja a um único `Dono = ForeignKey(Usuario)`, e `scheduling/models.py:36-37`, `scheduling/views.py:93,116` e `scheduling/availability.py:41` assumem que **o dono é obrigatoriamente o único barbeiro** que atende naquela barbearia.
  - Curiosamente, `frontend/src/styles.css:152-196` já contém seletores legados não utilizados (`.agenda-grid`, `.professional`, `.professional-photo`) que previam colunas por profissional.
- **Lacuna / Risco em produção**:
  - Barbearias reais com 2 a 10 cadeiras não conseguem cadastrar seus barbeiros colaboradores, gerenciar agendas paralelas simultâneas ou diferenciar o gestor/dono dos profissionais que atendem.
- **Escopo recomendado**:
  - Criar modelo de vínculo `ProfissionalBarbearia` (ou `BarbeiroVinculo`) relacionando `BarberShop` e `Usuario`, com papel (`dono`/`gestor`/`barbeiro`), status `ativo`, comissão padrão (`percentual_comissao`), especialidades e foto.
  - Atualizar `available_times` e `POST /scheduling/` para aceitar `barbeiro` dentro dos profissionais ativos da loja (ou seleção "Qualquer profissional disponível") e atualizar o frontend (`BookingDialog`, `BarberPanel` e grade por profissional aproveitando a base visual de `.agenda-grid`).
- **Critérios de aceite e dependências**:
  - Depende de REC-10 e REC-05.
  - Dois barbeiros vinculados à mesma `BarberShop` conseguem receber agendamentos simultâneos no mesmo horário sem conflito entre si, mantendo unicidade por barbeiro.

---

#### REC-12 — Calendário Semanal, Intervalos de Almoço, Feriados e Bloqueios Pontuais
- **O que existe hoje (Evidência no código)**:
  - `barber/barbshop/models.py:12-13` define somente um par `horario_abertura` e `horario_fechamento` aplicado indistintamente a todos os dias do ano em `scheduling/availability.py:10-25`.
- **Lacuna / Risco em produção**:
  - Não é possível configurar domingo fechado, sábado com expediente reduzido, horário de almoço diário (ex.: 12:00–13:00), feriados nacionais/municipais ou folgas médicas/imprevistos de um barbeiro sem alterar manualmente o horário de abertura da loja inteira.
- **Escopo recomendado**:
  - Criar `HorarioFuncionamento` (por dia da semana 0–6, flag `fechado`, abertura, fechamento, início/fim de intervalo) por loja/barbeiro, e `BloqueioAgenda` (data/hora início e fim, motivo, recorrente ou pontual para feriados e folgas).
  - Integrar ambos em `scheduling/availability.py` e criar tela de gestão de horários e bloqueios no painel do barbeiro.
- **Critérios de aceite e dependências**:
  - Depende de REC-05 (opcionalmente combinada com REC-11).
  - Dias marcados como fechados ou horários cobertos por `BloqueioAgenda` retornam `[]` ou omitidos em `available_times` e são recusados no `POST /scheduling/`.

---

#### REC-13 — Busca/Filtros, Histórico do Cliente, Filtro Multi-Loja e Melhorias de UX/Mídia
- **O que existe hoje (Evidência no código)**:
  - `frontend/src/Dashboard.jsx:291-351` oferece apenas filtro por barbearia em `ServicesCatalog`; `ShopCatalog` e `BarberClients` não possuem busca textual, filtros nem ordenação; `BarberPanel` trunca clientes em `clients.value?.slice(0, 8)` (`Dashboard.jsx:189`).
  - Um barbeiro com mais de uma barbearia não consegue filtrar `#painel` ou `#agenda` por estabelecimento; `api.barbers` (`frontend/src/api.js:174`) não é utilizado em nenhuma tela; `Dashboard` do cliente mistura reservas passadas e futuras na mesma lista filtrada por data única.
  - `barber/barber/settings.py` não configura `MEDIA_URL`/`MEDIA_ROOT`, e modelos `BarberShop`, `Usuario` e `Service` não possuem fotos reais (usando imagens estáticas genéricas `barbearia.jpg` e `equipe.jpg`).
  - Não há `ErrorBoundary` no React (`frontend/src/App.jsx`).
- **Lacuna / Risco em produção**:
  - Com dezenas de barbearias, serviços e centenas de clientes, a navegação fica lenta e confusa; barbeiros perdem o contexto ao operar múltiplas unidades; e erros inesperados de renderização deixam tela branca sem recuperação amigável.
- **Escopo recomendado**:
  - No backend: adicionar filtros via query params em `/barbshop/` e `/service/` (busca `q`, bairro/cidade, faixa de preço, ordenação) e suporte a upload seguro de imagens (`MEDIA_ROOT` + armazenamento S3/R2 em produção com validação Pillow).
  - No frontend: adicionar busca em `BarberClients` e `ShopCatalog`, filtro por barbearia no `BarberPanel`, abas "Próximos" / "Histórico" para o cliente sem depender apenas do seletor diário, modal de confirmação para exclusões e `ErrorBoundary` global.
- **Critérios de aceite e dependências**:
  - Depende de REC-03 (paginação) e REC-04 (servimento de mídia/estáticos).
  - Cliente visualiza separadamente seus agendamentos futuros e passados; barbeiro busca qualquer cliente sem limite artificial de 8 itens.

---

#### REC-14 — Indicadores Financeiros/Operacionais por Período e Exportação (CSV/PDF)
- **O que existe hoje (Evidência no código)**:
  - `Summary` (`frontend/src/Dashboard.jsx:27-46`) exibe apenas `Receita prevista`, `Agendamentos`, `Meus clientes` e `Ticket médio` calculados no cliente apenas para a data selecionada.
- **Lacuna / Risco em produção**:
  - Gestores não conseguem acompanhar faturamento semanal/mensal realizado (separado do previsto e excluindo cancelados/no-show), taxa de ocupação da cadeira, taxa de faltas, repasse de comissão por barbeiro ou exportar fechamento contábil.
- **Escopo recomendado**:
  - Criar endpoint dedicado de métricas agregadas no backend (ex.: `GET /scheduling/metrics/?start=YYYY-MM-DD&end=YYYY-MM-DD&barbearia=...&barbeiro=...`) calculando receita realizada (`CONCLUIDO`), receita prevista (`CONFIRMADO`), cancelamentos, no-shows, taxa de ocupação e exportação CSV.
  - Atualizar o painel do barbeiro (`#painel`) com seletor de período (Dia / Semana / Mês / Personalizado) e botão de exportação.
- **Critérios de aceite e dependências**:
  - Depende de REC-05 (`status`) e REC-06 (`preco_registrado`).
  - Cálculos agregados batem exatamente com o somatório dos registros filtrados e são validados por testes unitários no backend.

---

#### REC-15 — CI/CD com PostgreSQL 18, Backups Automatizados, Linters e Testes Frontend/E2E
- **O que existe hoje (Evidência no código)**:
  - A suíte atual de 79 testes roda via `USE_SQLITE=1`; `barber/barbshop/tests.py`, `barber/service/tests.py` e `barber/scheduling/tests.py` são stubs de 3 linhas.
  - Não existem linters (`ruff`, `eslint`), nem testes unitários/E2E do frontend (`vitest`, `playwright`), nem workflow de CI (`.github/workflows/`) ou rotina de backup do volume `postgres_data` (`compose.yaml:12`).
- **Lacuna / Risco em produção**:
  - Divergências de comportamento entre SQLite e PostgreSQL (ex.: constraints, tipos de data/hora, locking transacional) podem quebrar em produção sem detecção prévia; alterações no frontend podem quebrar autenticação ou reserva sem alertas automatizados; falhas de disco ou erro humano sem backup causam perda irreversível dos dados da barbearia.
- **Escopo recomendado**:
  - Configurar pipeline de CI executando: `ruff` + `manage.py check --deploy` + `manage.py test` contra **PostgreSQL 18**, além de `eslint` + testes de fluxo crítico no React (`Vitest` / `Playwright`).
  - Expandir testes de concorrência real no PostgreSQL e preencher testes de `barbshop` (CRUD e validações).
  - Documentar e automatizar política de backups diários (`pg_dump` criptografado + retenção e teste periódico de restore).
- **Critérios de aceite e dependências**:
  - Depende de REC-01.
  - Pipeline verde bloqueando merges com falha em PostgreSQL, build Vite ou linter.

---

### P2 — Diferenciação Competitiva e Monetização

#### REC-16 — Pagamentos Online, Sinal Anti-No-Show (Pix/Cartão) e Checkout de Caixa
- **O que existe hoje (Evidência no código)**:
  - `Scheduling` (`barber/scheduling/models.py`) e `Service` (`barber/service/models.py`) não possuem modelo de `Pagamento`, status financeiro (`PENDENTE`, `PAGO`, `ESTORNADO`), método (`PIX`, `CARTAO`, `DINHEIRO`) nem webhook de gateway.
- **Lacuna / Risco em produção**:
  - Barbearias ficam sem ferramenta para cobrar sinal antecipado contra faltas ou conciliar o que foi efetivamente pago na recepção vs. agendado no app.
- **Escopo recomendado**:
  - Integrar gateway nacional com suporte a Pix dinâmico e cartão (ex.: Mercado Pago, Asaas ou Stripe) com criação idempotente de cobrança, webhook assinado para confirmação automática do agendamento/sinal e tela de fechamento de comanda (PDV simples) no painel do barbeiro.
- **Critérios de aceite e dependências**:
  - Depende de REC-05, REC-06 e REC-09.
  - Webhooks validados por assinatura secreta atualizam o status do pagamento de forma idempotente mesmo em reenvios duplicados.

---

#### REC-17 — Fidelidade, Pacotes de Serviços, Assinaturas e Cupons Promocionais
- **O que existe hoje (Evidência no código)**:
  - Cada agendamento referencia exatamente um `Service` (`scheduling/models.py:21`), sem suporte a múltiplos serviços por atendimento, créditos pré-pagos, planos mensais ou descontos.
- **Lacuna / Risco em produção**:
  - Limita estratégias comerciais comuns em barbearias modernas (combo corte+barba com seleção múltipla, cartão fidelidade "10º corte grátis" e clubes de assinatura mensal para receita recorrente).
- **Escopo recomendado**:
  - Permitir múltiplos itens por agendamento (`AgendamentoItem`), cupons de desconto por barbearia com validade/limite de uso, regra configurável de fidelidade por atendimentos concluídos (`CONCLUIDO`) e planos recorrentes vinculados a REC-16.
- **Critérios de aceite e dependências**:
  - Depende de REC-05, REC-06, REC-10 e REC-16 (para assinaturas cobradas automaticamente).

---

#### REC-18 — Avaliações Verificadas, Favoritos e Portfólio de Cortes
- **O que existe hoje (Evidência no código)**:
  - Não existe sistema de avaliação, pontuação média, lista de favoritos do cliente nem galeria de fotos de trabalhos realizados por barbearia/barbeiro.
- **Lacuna / Risco em produção**:
  - Clientes novos que exploram `#barbearias` (`Dashboard.jsx:291-315`) não possuem prova social para comparar estabelecimentos e escolher um profissional.
- **Escopo recomendado**:
  - Criar modelo `Avaliacao` vinculado 1:1 a um `Scheduling` com `status=CONCLUIDO` (nota 1–5 + comentário opcional + resposta do barbeiro), favoritos do cliente e galeria de portfólio integrada ao armazenamento de mídia (REC-13).
- **Critérios de aceite e dependências**:
  - Depende de REC-05 e REC-13.
  - Apenas clientes com atendimento `CONCLUIDO` podem enviar exatamente uma avaliação para aquela reserva.

---

#### REC-19 — Conformidade LGPD, Exportação `.ics`, Lista de Espera e Publicação OpenAPI (`drf-yasg`)
- **O que existe hoje (Evidência no código)**:
  - `requirements.txt:7` já inclui `drf-yasg==1.21.10`, porém `barber/barber/urls.py` não expõe nenhuma rota Swagger/OpenAPI.
  - O cadastro (`Usuario/serializer.py:53-92`) coleta dados pessoais sensíveis (`cpf`, `Telefone`, `email`) sem registro de aceite de Termos/Política de Privacidade, sem rotina de portabilidade ou exclusão/anonimização de conta (LGPD), sem exportação de evento `.ics` e sem lista de espera para horários lotados.
- **Lacuna / Risco em produção**:
  - A coleta de CPF/telefone sem consentimento explícito e mecanismo de exclusão/anonimização gera risco regulatório frente à LGPD; clientes perdem vagas abertas por cancelamentos de última hora; e integrações externas/mobile ficam sem contrato OpenAPI publicado.
- **Escopo recomendado**:
  - Registrar timestamp e versão de aceite de Termos/Privacidade (`lgpd_aceite_em`), oferecer endpoint de exportação dos próprios dados (JSON) e solicitação de exclusão/anonimização preservando anonimamente registros fiscais necessários.
  - Gerar link/download `.ics` após reserva confirmada, fila de espera automática notificada via REC-09 quando um horário for cancelado (REC-05), e montar `/api/docs/` via `drf-yasg` (ou `drf-spectacular` em evolução futura) restrito ou documentado conforme política de ambiente.
- **Critérios de aceite e dependências**:
  - Depende de REC-05 e REC-09 (para avisos da lista de espera).
  - `/api/docs/` renderiza o schema completo da API sem erros de introspecção nos ViewSets, e fluxo de anonimização remove PII de `User`/`Usuario` sem quebrar integridade referencial de relatórios financeiros.
