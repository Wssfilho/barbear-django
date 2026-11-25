# Publicação do Barbear

## Hospedar nesta máquina

Com Docker Desktop iniciado, execute na raiz:

```bash
python3 deploy/host.py start
```

O comando cria `.env.host` com segredos aleatórios e permissão de leitura
restrita ao seu usuário, inicia Django/React e um PostgreSQL persistente, cria
um administrador e abre um Quick Tunnel da Cloudflare. O endereço HTTPS
público aparece no terminal. A senha do administrador está em `ADMIN_PASSWORD`
no arquivo privado `.env.host`; o usuário é `admin`.

Esse banco de produção começa vazio e fica no volume Docker
`barbear-host_host_postgres`. Os bancos de desenvolvimento existentes são
independentes. O PostgreSQL não publica uma porta na máquina; a aplicação
escuta apenas em `127.0.0.1:8080` e o túnel entrega o acesso público por HTTPS.

```bash
python3 deploy/host.py status
python3 deploy/host.py backup
python3 deploy/host.py stop
```

`stop` preserva os dados. Os backups são salvos em `backups/`, com permissão
restrita. Copie-os também para outro dispositivo. Não exclua o volume Docker
nem o arquivo `.env.host`: ele contém as credenciais necessárias para reabrir
o banco. Para atualizar o código ou reconectar, execute `start` novamente.

O computador precisa ficar ligado, conectado e sem suspensão para o acesso
continuar. Os serviços web/banco reiniciam com o Docker; execute `start` para
reabrir o túnel depois de reiniciar a máquina. Quick Tunnels têm endereço
temporário e são voltados a testes, conforme a
[documentação da Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
Para uso contínuo com endereço fixo, conecte um domínio a um túnel nomeado da
Cloudflare. Não é necessário abrir portas no roteador para usar esse túnel.

## Consultoria com IA e planos mensais

Clientes encontram **Consultoria com IA** no menu. A consulta considera tipo
e comprimento do cabelo, estilo, rotina de manutenção, frequência de visitas
e orçamento opcional. O assistente sugere cortes; o Django calcula o custo
mensal de atendimentos avulsos e dos planos cadastrados, incluindo visitas
extras. Em caso de empate, recomenda o pagamento avulso. Não há contratação
de assinatura, cobrança ou controle de créditos nesta funcionalidade.

Barbeiros cadastram os planos em **Planos mensais**, vinculando cada plano a
um serviço da própria barbearia. Cada plano inclui uma quantidade de
atendimentos por mês; os extras usam o preço avulso atual do serviço.

Configure a integração externa no arquivo privado `.env.host`:

```dotenv
AI_PROVIDER=gemini
AI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=coloque_a_chave_privada_aqui
AI_REQUESTS_PER_HOUR=10
AI_COOLDOWN_SECONDS=30
```

Também há suporte a `AI_PROVIDER=openai` com `OPENAI_API_KEY` e `AI_MODEL`.
Depois de configurar, execute `python3 deploy/host.py start` para aplicar a
configuração. Não use o prefixo `VITE_` para chaves: elas pertencem somente ao
servidor. O `.env.example` tem os nomes das variáveis, sem credenciais reais.

`GET /django/assistant/status/` informa se a configuração está preenchida;
isso não comprova saldo, permissão de modelo ou conectividade com o provedor.
Sem configuração, a interface informa indisponibilidade e não simula respostas.
O acesso às recomendações exige conta de cliente. O limite é persistido no
banco por usuário e inclui intervalo entre consultas e proteção contra
reenvio idêntico durante cinco minutos. As chaves e mensagens brutas de erro
do provedor não são devolvidas ao navegador.

O provedor recebe as características e preferências de corte. Cadastro,
histórico de reservas, preços e planos não são enviados. Campos de contato
numéricos e emails informados nas preferências são removidos antes do envio.
As preferências e respostas não são persistidas na aplicação; o histórico
técnico salva apenas contadores, horário e resumo criptográfico de solicitações
para o limite de uso. O tratamento pelo provedor segue a política da conta
Gemini ou OpenAI contratada.

Referências de integração: [Gemini](https://ai.google.dev/gemini-api/docs/structured-output)
e [OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).

## Publicar em um provedor externo

O repositório contém um `Dockerfile` que compila o React e executa o Django com
Gunicorn. A interface abre em `/`, a API usada por ela em `/django/`, o Django
Admin em `/admin/` e a verificação do banco em `/health/`. As rotas anteriores
da API continuam disponíveis. A navegação da interface usa `#`, portanto não
precisa de um fallback para caminhos arbitrários.

## O que falta para publicar

Escolher a hospedagem, conectar a conta/repositório e criar um PostgreSQL
persistente. A configuração local não publica o sistema sozinha. O projeto
possui alterações locais ainda não enviadas ao GitHub; uma hospedagem que faz
deploy pelo Git só recebe as alterações depois de um commit e push.

## Configuração da hospedagem

1. Criar um banco PostgreSQL e guardar sua URL nas variáveis privadas do serviço.
2. Criar um serviço web a partir do `Dockerfile` na raiz deste repositório.
3. Configurar as variáveis abaixo e iniciar o deploy.
4. Conferir `/health/`, abrir `/`, testar cadastro/login e uma reserva.
5. Criar um administrador no terminal privado da hospedagem:
   `python barber/manage.py createsuperuser`.
6. Para cadastrar um barbeiro, criar o usuário pelo admin e executar
   `python barber/manage.py criar_barbeiro nome_do_usuario`. Depois, entrar
   na interface como barbeiro e cadastrar a barbearia e seus serviços.

| Variável | Valor |
| --- | --- |
| `DJANGO_SETTINGS_MODULE` | `barber.production` (já definido na imagem) |
| `SECRET_KEY` | Chave aleatória privada com pelo menos 50 caracteres |
| `DATABASE_URL` | URL PostgreSQL fornecida pela hospedagem |
| `ALLOWED_HOSTS` | Domínios exatos, separados por vírgula, sem `https://` |
| `CSRF_TRUSTED_ORIGINS` | Origens completas, por exemplo `https://seu-dominio.com` |
| `TRUST_PROXY_HTTPS` | `1` quando a hospedagem termina HTTPS e normaliza `X-Forwarded-Proto` |
| `PORT` | Porta fornecida pela hospedagem; padrão `8000` |
| `WEB_CONCURRENCY` | Número de processos Gunicorn; padrão `2` |
| `CORS_ALLOWED_ORIGINS` | Necessário apenas se a interface estiver em outra origem |

Gere a chave em sua máquina e copie apenas para a configuração privada:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(64))'
```

Para conexões externas ao PostgreSQL, use o parâmetro TLS exigido pelo
provedor na URL, por exemplo `?sslmode=require`. Não use o banco local ou
SQLite como armazenamento do serviço publicado. O Docker não copia `.env`,
bancos locais, `.git` nem o ambiente virtual.

O serviço verifica a configuração de produção, aplica migrações e inicia o
Gunicorn. Se a hospedagem oferecer uma etapa de pré-deploy, prefira executar
`python barber/manage.py migrate --noinput` nessa etapa e iniciar somente o
Gunicorn no serviço, especialmente ao usar várias réplicas.

## Verificação local

```bash
USE_SQLITE=1 .venv/bin/python barber/manage.py test Usuario barbshop service scheduling barber
npm --prefix frontend run build
docker build -t barbear .
```

Para executar a imagem, crie `.env.production` seguindo `.env.example` e use:

```bash
docker run --rm --env-file .env.production -p 8000:8000 barbear
```

As variáveis de arquivo `.env` não são carregadas automaticamente pelo Django;
`docker run --env-file` faz essa injeção. O banco deve ser acessível a partir do
container; `localhost` dentro dele aponta para o próprio container. Em macOS,
um banco rodando na máquina pode ser acessado por `host.docker.internal`.

A configuração de produção exige HTTPS. Use um proxy HTTPS confiável para
testar a interface; o `/health/` também aceita sondas HTTP internas. Para
desenvolvimento sem HTTPS, continue usando `barber.settings` com Django e Vite.

## Dados e operação

O deploy cria as tabelas, mas não transfere os usuários e agendamentos locais.
Para preservar esses dados, planeje a exportação/importação antes de abrir
cadastros na hospedagem. Habilite backups do PostgreSQL e teste a restauração.
Mantenha senhas, tokens e URLs de conexão nas variáveis privadas do provedor.

O arquivo `RECOMMENDATIONS.md` registra melhorias de produto e operação que
continuam relevantes. Esta preparação de deploy não implementa todas elas.
