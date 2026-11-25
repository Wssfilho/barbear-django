# Barbear Django

Plataforma de barbearias, serviços e agendamentos, com API em Django REST Framework, Django Admin e frontend em React.

Para publicar a versão atual com Docker, PostgreSQL e HTTPS, consulte o
[guia de deploy](DEPLOY.md). Ele descreve a nova configuração
`barber.production`; as seções históricas de produção abaixo descrevem a
configuração local `barber.settings`.

Este guia descreve o código atual e aponta os pontos que precisam de ajuste para integrar o frontend. A visão de produto, as telas e as sugestões de evolução estão no [briefing](BRIEFING.md).

## Sumário

- [Estado atual](#estado-atual)
- [Tecnologias e estrutura](#tecnologias-e-estrutura)
- [Execução local](#execução-local)
- [Modelo de dados](#modelo-de-dados)
- [Convenções da API](#convenções-da-api)
- [Autenticação](#autenticação)
- [Endpoints e contratos](#endpoints-e-contratos)
- [Guia para o frontend](#guia-para-o-frontend)
- [Pendências do backend](#pendências-do-backend)
- [Verificação e publicação](#verificação-e-publicação)

## Estado atual

| Área | Implementação atual |
| --- | --- |
| Usuários | Cadastro, perfil vinculado ao Django User e consulta do usuário autenticado |
| Autenticação | Emissão e renovação de JWT |
| Barbearias | Listagem pública, criação e atualização completa por barbeiros |
| Serviços | Listagem pública por barbearia; escrita incompleta |
| Agendamentos | Disponibilidade pública, criação e cancelamento restritos a barbeiros |
| Administração | Django Admin com os quatro modelos de negócio |
| Banco | PostgreSQL 18 no Docker, com volume persistente |
| Frontend | Painel demonstrativo e integração com catálogo, autenticação e reservas da API |
| Testes de negócio | Arquivos de teste existentes ainda são esboços |
| Swagger/OpenAPI | Dependência instalada, sem rotas configuradas |

O fluxo de reserva por clientes ainda não está pronto. Consulte as [pendências](#pendências-do-backend) antes de considerar o contrato definitivo.

## Tecnologias e estrutura

- Django `5.2` e Django REST Framework `3.16.0`.
- Simple JWT `5.5.0`.
- PostgreSQL `18`, psycopg2-binary `2.9.11` e Docker Compose.
- Gunicorn nas dependências para execução WSGI.
- `django-cors-headers` instalado, mas sem middleware e origens configurados.
- Versões completas em [requirements.txt](requirements.txt).

```text
barbear-django/
├── README.md
├── BRIEFING.md
├── compose.yaml             # Serviço db e volume persistente
├── requirements.txt
├── frontend/                # Interface React e servidor Vite
└── barber/
    ├── manage.py
    ├── barber/              # settings, urls, wsgi e asgi
    ├── Usuario/             # Perfil vinculado ao Django User
    ├── barbshop/            # Estabelecimentos e permissão IsBarbeiro
    ├── service/             # Catálogo de serviços
    └── scheduling/          # Reservas e consulta de horários
```

Cada app contém modelos, serializers, views, rotas, registro no admin e migrações.

## Execução local

### Pré-requisitos

- Python compatível com Django 5.2; o ambiente local utilizado tem Python 3.14.2.
- Docker Desktop iniciado, com Docker Compose disponível.
- Portas `5433` para PostgreSQL e `8000` para Django livres.

Execute os comandos abaixo na raiz do repositório, em macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt

docker compose up -d --wait
POSTGRES_PORT=5433 USE_SQLITE=0 .venv/bin/python barber/manage.py migrate
POSTGRES_PORT=5433 USE_SQLITE=0 .venv/bin/python barber/manage.py runserver 127.0.0.1:8000
```

Se a `.venv` já existir com as dependências instaladas, basta iniciar o banco, executar migrações pendentes e iniciar o servidor.

| Recurso | Endereço |
| --- | --- |
| Listagem pública de barbearias | http://localhost:8000/barbshop/ |
| Administração | http://localhost:8000/admin/ |
| Emissão de tokens | `POST http://localhost:8000/api/token/` |
| PostgreSQL | `localhost:5433` |

O servidor `runserver` é para desenvolvimento. O Compose executa somente o banco; o Django roda na máquina. A raiz do Django resolve o API root do primeiro router. A interface React roda pelo Vite na porta 5173.

### Executar o frontend React

Com Node.js 20.19+ ou 22.12+, execute na raiz do repositório:

```bash
npm --prefix frontend ci
npm --prefix frontend run dev
```

Abra [http://localhost:5173](http://localhost:5173). O painel abre em modo demonstração, com dados de exemplo e alterações salvas no navegador. Para usar o Django, mantenha a API em execução e clique em **Conectar à API** no menu. O painel da API mostra o catálogo público e os horários globais. Com um perfil de barbeiro, você pode reservar para a própria conta, listar e cancelar as reservas exibidas em **Meus agendamentos**.

O Vite encaminha `/django/` para `http://127.0.0.1:8000` por padrão. Use `DJANGO_URL` se a API local rodar em outro endereço. Para compilar, execute `npm --prefix frontend run build`. Ao servir `frontend/dist/`, configure um proxy para `/django/` na mesma origem ou compile com `VITE_API_URL` apontando para uma API que aceite a origem do frontend via CORS.

### Banco e persistência

| Parâmetro | Valor local |
| --- | --- |
| Banco | `Tramontina` |
| Usuário | `postgres` |
| Senha de desenvolvimento | `123` |
| Porta na máquina | `5433` |
| Porta dentro do container | `5432` |
| Volume Compose | `postgres_data` |

```bash
docker compose ps
docker compose logs --tail=50 db
docker compose exec db psql -U postgres -d Tramontina
docker compose stop
```

`docker compose stop` preserva os dados. O volume é montado em `/var/lib/postgresql`, conforme a configuração utilizada para PostgreSQL 18.

### Configuração que o código realmente lê

| Variável | Comportamento |
| --- | --- |
| `USE_SQLITE=1` | Usa `barber/db.sqlite3` em vez de PostgreSQL |
| `USE_SQLITE=0` ou ausente | Usa PostgreSQL |
| `POSTGRES_PORT` | Porta PostgreSQL; padrão `5432`, use `5433` com o Compose |

Nome do banco, usuário, senha e host continuam definidos em `settings.py`. O projeto não carrega `.env` automaticamente e ainda não lê `DATABASE_URL`, `SECRET_KEY`, `DEBUG` ou `ALLOWED_HOSTS` do ambiente.

O SQLite é uma alternativa local existente; seus dados são independentes dos dados do PostgreSQL.

### Preparar dados para desenvolver o frontend

Crie um administrador:

```bash
POSTGRES_PORT=5433 USE_SQLITE=0 .venv/bin/python barber/manage.py createsuperuser
```

No admin:

1. Crie um `Usuario` vinculado a um Django User e atribua `TipoUsuario = 2` para testar como barbeiro.
2. Crie uma barbearia com esse perfil como `Dono`.
3. Crie serviços e vincule cada um à barbearia.
4. Use o username e a senha do Django User no endpoint de login JWT.

O superusuário não recebe automaticamente um `Usuario`. Preparar serviços pelo admin contorna a lacuna atual de criação de serviços na API. Não há comando de seed ou fixtures de demonstração.

## Modelo de dados

| Entidade | Campos principais | Relações |
| --- | --- | --- |
| Django `User` | `id`, `username`, senha, nome, sobrenome e email | Um perfil `Usuario` |
| `Usuario` | `id`, `Telefone` até 11 caracteres, `cpf` até 11 caracteres, `TipoUsuario` | `Vinculado` → User, um para um |
| `BarberShop` | `Nome`, `Endereco`, `Telefone`, `Email`, abertura e fechamento | `Dono` → Usuario |
| `Service` | `Nome`, `Descricao`, `Preco` decimal com duas casas | `Barbearia` → BarberShop |
| `Scheduling` | `descricao` opcional, data e horário | `cliente` → Usuario; `servico` → Service |

Tipos de usuário: `1 = cliente`, `2 = barbeiro`. Não há entidade separada para equipe/profissional nem vínculo de um barbeiro empregado com uma barbearia.

As relações usam exclusão em cascata. Apagar usuários, barbearias ou serviços pode apagar registros dependentes, incluindo agendamentos. Não há histórico de status nem cópia do preço contratado na reserva.

## Convenções da API

- URL base local: `http://localhost:8000`.
- Usar barra final: `/usuario/`, `/barbshop/`, `/service/` e `/scheduling/`.
- `Content-Type: application/json` para corpos JSON.
- Campos distinguem maiúsculas e minúsculas: `Nome` não é `nome`; `Telefone` na resposta de perfil difere de `telefone` no cadastro.
- Datas: `YYYY-MM-DD`. Horários: `HH:MM` no envio, normalmente `HH:MM:SS` na serialização.
- Valores monetários: strings decimais, por exemplo `"30.00"`.
- IDs de `User` e de `Usuario` são distintos. As relações de negócio usam o ID do perfil `Usuario`.
- Não há paginação configurada nem formato único de resposta.
- Várias views retornam `status` no JSON sem definir o status HTTP. Por exemplo, um cadastro pode responder HTTP 200 com `{"status": 201}`; uma validação pode responder HTTP 200 com `{"status": 400}`.
- Tratar tanto o HTTP quanto o corpo enquanto esse contrato não for corrigido. Algumas exceções ainda podem gerar HTTP 500 e resposta não JSON.

## Autenticação

### Login

`POST /api/token/`

```json
{"username": "barbeiro_demo", "password": "sua-senha"}
```

Resposta HTTP 200:

```json
{"refresh": "<refresh-token>", "access": "<access-token>"}
```

Credenciais inválidas retornam HTTP 401. O login usa `username`, não email.

Nos endpoints protegidos:

```http
Authorization: Bearer <access-token>
```

### Renovação

`POST /api/token/refresh/`

```json
{"refresh": "<refresh-token>"}
```

Resposta HTTP 200:

```json
{"access": "<novo-access-token>"}
```

Configuração atual: access de 90 dias e refresh de 1 dia, sem rotação. Essa combinação precisa ser revista antes de uma sessão definitiva de frontend. Não há logout/revogação de JWT nem recuperação de senha implementados; sair da interface apenas descarta a sessão no cliente. A opção de blacklist presente nas configurações não fornece uma rota de revogação.

## Endpoints e contratos

### Visão geral

“Barbeiro” abaixo significa usuário autenticado com perfil `TipoUsuario = 2`.

| Método | Rota | Acesso atual | Observação |
| --- | --- | --- | --- |
| POST | `/api/token/` | Público | Login |
| POST | `/api/token/refresh/` | Público, com refresh válido | Renovação |
| POST | `/usuario/` | Público | Cadastro |
| GET | `/usuario/` | Barbeiro | Lista todos os perfis |
| GET | `/usuario/me/` | `AllowAny`, mas depende do usuário autenticado | Enviar JWT; sem ele pode ocorrer erro |
| GET | `/usuario/{id}/` | Barbeiro | Detalhe herdado |
| PUT/PATCH | `/usuario/{id}/` | Público nas permissões | Escrita herdada inadequada; não integrar sem correção |
| DELETE | `/usuario/{id}/` | Barbeiro | `destroy` herdado, sem filtro por dono |
| GET | `/barbshop/` | Público | Lista barbearias |
| POST | `/barbshop/` | Barbeiro | Cria usando o usuário como dono |
| GET | `/barbshop/{id}/` | Barbeiro | Detalhe não é público |
| PUT | `/barbshop/{id}/` | Barbeiro e dono | Atualização completa personalizada |
| PATCH | `/barbshop/{id}/` | Barbeiro e dono na implementação atual | Reutiliza `update`; enviar todos os campos |
| DELETE | `/barbshop/{id}/` | Barbeiro | `destroy` herdado, sem filtro por dono |
| GET | `/service/?id={barbshop_id}` | Público | Lista serviços da barbearia |
| GET | `/service/{id}/` | Barbeiro | Detalhe herdado |
| POST | `/service/` | Barbeiro | Falta relação de barbearia no serializer de escrita |
| PUT/PATCH | `/service/{id}/` | Barbeiro | Atualização herdada, sem filtro por dono |
| DELETE | `/service/{id}/` | Barbeiro | Exclusão herdada, sem filtro por dono |
| GET | `/scheduling/available_times/?date=YYYY-MM-DD` | Público | Disponibilidade global por data |
| GET | `/scheduling/` | Barbeiro | Somente registros em que ele é o cliente |
| POST | `/scheduling/` | Barbeiro | Cria reserva para o próprio perfil |
| GET | `/scheduling/{id}/` | Barbeiro | Sem filtro de propriedade |
| PUT/PATCH | `/scheduling/{id}/` | Barbeiro | Escrita herdada com relações aninhadas; precisa de ajuste |
| DELETE | `/scheduling/{id}/` | Barbeiro | Remove reserva sem verificar propriedade |

Essas são as rotas registradas e permissões observadas no código. Uma rota registrada não significa que todos os casos de uso estejam funcionais ou autorizados de forma adequada.

### Cadastro de usuário

`POST /usuario/`

```json
{
  "username": "cliente_demo",
  "password": "sua-senha",
  "first_name": "Maria",
  "email": "maria@example.com",
  "telefone": "71999999999",
  "cpf": "12345678901",
  "tipo_usuario": 1
}
```

Resposta atual: HTTP 200, corpo:

```json
{"status": 201, "msg": "User registered successfully"}
```

A view verifica presença de username, senha, primeiro nome e email. Envie telefone e CPF também: o código passa esses valores diretamente à criação do perfil. `tipo_usuario` tem padrão 1. Não há validação completa de CPF, telefone, email, força da senha ou tratamento de username duplicado. O cadastro permite escolher o tipo 2 sem aprovação e não usa transação para criar User e perfil.

### Perfil autenticado

`GET /usuario/me/`, com Bearer JWT:

```json
{
  "status": 302,
  "Usuario": {
    "id": 1,
    "Vinculado": {
      "id": 1,
      "username": "cliente_demo",
      "first_name": "Maria",
      "last_name": "",
      "email": "maria@example.com"
    },
    "Telefone": "71999999999"
  }
}
```

O HTTP é 200; `302` é apenas um campo do JSON. O serializer não retorna `cpf` nem `TipoUsuario`. Portanto, o frontend ainda não consegue identificar o papel do usuário por esse endpoint.

`GET /usuario/` usa o mesmo formato de perfil dentro de um array em `Usuario`. Quando vazio, retorna `{"status": 204, "msg": "No Content"}`, também com HTTP 200.

### Barbearias

`GET /barbshop/`:

```json
{
  "status": 200,
  "barbershops": [{
    "id": 1,
    "Dono": {"id": 2, "nome": "João"},
    "Nome": "Barbearia Centro",
    "Endereco": "Rua Exemplo, 100",
    "Telefone": "71999999999",
    "Email": "contato@example.com",
    "horario_abertura": "08:00:00",
    "horario_fechamento": "18:00:00"
  }]
}
```

Lista vazia: `{"status": 200, "barbershops": []}`.

`POST /barbshop/` e `PUT /barbshop/{id}/` recebem:

```json
{
  "Nome": "Barbearia Centro",
  "Endereco": "Rua Exemplo, 100",
  "Telefone": "71999999999",
  "Email": "contato@example.com",
  "horario_abertura": "08:00",
  "horario_fechamento": "18:00"
}
```

Todos os campos são exigidos. Não enviar `Dono`: a criação usa o perfil autenticado. Sucesso na criação: HTTP 200 com `{"status": 201, "message": "Barbearia criada com sucesso.", "barbshop_id": 1}`. Atualização: HTTP 200 com `{"status": 200, "message": "Barbearia atualizada com sucesso."}`.

No PUT/PATCH, a view procura a barbearia pelo ID e pelo dono. Ausência retorna um corpo com `status: 404`, ainda com HTTP 200. Essa proteção não foi implementada no DELETE herdado.

### Serviços

`GET /service/?id=1`:

```json
{
  "status": 200,
  "services": [{
    "id": 1,
    "Nome": "Corte de cabelo",
    "Descricao": "Corte tradicional",
    "Preco": "30.00"
  }]
}
```

Sem `id`: HTTP 400. Sem serviços para o ID informado: HTTP 404 com `{"status": 404, "message": "Nenhum serviço encontrado para esta barbearia"}`. Esse caso deve virar estado vazio na interface, não uma tela de falha genérica.

O serializer de serviço não retorna `Barbearia`; mantenha o ID do estabelecimento no contexto da tela. Ele também não recebe essa relação na criação, embora seja obrigatória no modelo. Por enquanto, preparar serviços no admin.

O PATCH roteado usa `partial_update` herdado e aceita os campos `Nome`, `Descricao` e `Preco`. O método personalizado chamado `patch` em `views.py` não é executado pelo router. Não há verificação de que o serviço pertence ao barbeiro autenticado.

### Horários disponíveis

`GET /scheduling/available_times/?date=2026-11-20`:

```json
{
  "date": "2026-11-20",
  "available_times": ["08:00", "08:20", "08:40", "09:00"]
}
```

O exemplo mostra apenas parte da lista. A geração vai de `08:00` até `18:00`, inclusive, de 20 em 20 minutos, removendo os horários já reservados na data.

- Sem data ou formato inválido: HTTP 400, com mensagem em `error`.
- Não recebe barbearia, serviço nem profissional.
- Usa agenda global e não utiliza abertura/fechamento cadastrados na barbearia.
- Não impede consultar datas passadas nem remove horários já passados do dia atual.
- Não considera duração do serviço, feriados ou intervalos.

### Criar agendamento

`POST /scheduling/`, com JWT de barbeiro:

```json
{
  "servico": 1,
  "data_agendamento": "2026-11-20",
  "horario_agendamento": "10:00",
  "descricao": "Preferência por corte social"
}
```

`descricao` é opcional. O cliente da reserva é sempre o perfil autenticado; não há campo para reservar em nome de outro cliente.

Resposta HTTP 201:

```json
{
  "message": "Agendamento criado com sucesso",
  "scheduling": {
    "id": 1,
    "cliente": {
      "id": 2,
      "Vinculado": {
        "id": 2,
        "username": "barbeiro_demo",
        "first_name": "João",
        "last_name": "",
        "email": "joao@example.com"
      },
      "Telefone": "71999999999"
    },
    "servico": {
      "id": 1,
      "Nome": "Corte de cabelo",
      "Descricao": "Corte tradicional",
      "Preco": "30.00"
    },
    "descricao": "Preferência por corte social",
    "data_agendamento": "2026-11-20",
    "horario_agendamento": "10:00:00"
  }
}
```

Horário ocupado: HTTP 400 com `{"error": "Horario indisponivel para agendamento"}`. Serviço inexistente, dados inválidos e conflitos simultâneos ainda não possuem tratamento uniforme.

### Listar e cancelar agendamentos

`GET /scheduling/` retorna diretamente um array de objetos no formato de `scheduling` acima, ou `[]`. Hoje lista reservas do barbeiro enquanto cliente; não é a agenda dos clientes da sua barbearia. Não há filtros implementados por data, estabelecimento ou profissional nessa listagem.

`DELETE /scheduling/{id}/` retorna HTTP 200 com `{"message": "Agendamento cancelado com sucesso"}`; ID inexistente retorna HTTP 404. O registro é apagado e qualquer barbeiro autorizado pela permissão de classe pode cancelar uma reserva pelo ID.

## Guia para o frontend

### Telas e dependências

| Tela proposta | Endpoints atuais | Dependência para concluir |
| --- | --- | --- |
| Catálogo | `GET /barbshop/` | Pode começar agora |
| Página da barbearia | Listagem + `GET /service/?id=...` | Detalhe público por ID ainda precisa de ajuste |
| Cadastro e login | `POST /usuario/`, `/api/token/`, `/usuario/me/` | Melhorar erros e devolver tipo de usuário |
| Seleção de horário | `/scheduling/available_times/` | Tornar disponibilidade específica por estabelecimento |
| Confirmação de reserva | `POST /scheduling/` | Liberar cliente e validar regras |
| Meus agendamentos | `GET /scheduling/` | Liberar cliente e preservar escopo individual |
| Meu perfil | `GET /usuario/me/` | Corrigir PATCH e autenticação |
| Gestão da barbearia | `POST/PUT /barbshop/` | Corrigir autorização nas demais operações |
| Gestão de serviços | `/service/` | Corrigir criação e escopo por dono |
| Agenda do estabelecimento | Ainda não existe consulta adequada | Criar listagem autorizada por barbearia |

### Ordem de integração

1. Construir catálogo com estados vazio, carregando e erro.
2. Integrar cadastro, login e leitura do perfil.
3. Ajustar os bloqueios P0 descritos no briefing.
4. Integrar seleção de serviço, data, horário e confirmação.
5. Integrar consulta e cancelamento das reservas do cliente.
6. Construir agenda e gestão para o dono.

Organize o frontend por funcionalidades, com uma camada central de comunicação com a API. Converta respostas da API para tipos consistentes nessa camada, evitando espalhar nomes como `Vinculado` e envelopes diferentes em todos os componentes.

### Exemplo de cliente HTTP

Este exemplo usa JavaScript e `fetch`, sem depender de framework. O token é recebido como argumento; ele não define uma política de persistência de sessão.

```js
const API_URL = "http://localhost:8000";

async function api(path, { token, body, headers, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Resposta inesperada da API (HTTP ${response.status}).`);
  }

  const bodyStatus = Number(data?.status);
  if (!response.ok || bodyStatus >= 400) {
    throw new Error(
      data?.detail || data?.error || data?.message || data?.msg ||
      `Falha na requisição (HTTP ${response.status}).`
    );
  }
  return data;
}

const { barbershops } = await api("/barbshop/");
const tokens = await api("/api/token/", {
  method: "POST",
  body: { username: "barbeiro_demo", password: "sua-senha" },
});
const { Usuario: perfil } = await api("/usuario/me/", {
  token: tokens.access,
});
```

Depois da padronização do backend, remova a dependência do campo `status` para identificar erros. Para renovação de sessão, limite a uma tentativa de refresh por falha de autenticação e retorne ao login se ela falhar.

### CORS para navegador em outra origem

Requisições de um frontend em outra porta/origem dependem de configuração adicional. O pacote já está instalado, mas é necessário acrescentar a `MIDDLEWARE`, antes de `CommonMiddleware`:

```python
'corsheaders.middleware.CorsMiddleware',
```

E definir as origens usadas pelo frontend, por exemplo:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

O servidor Vite já usa um proxy no desenvolvimento local. A configuração de CORS acima se aplica a hospedagens que acessam o Django diretamente de outra origem.

### Comportamentos da interface

- Mostrar preço em reais e datas no formato brasileiro; enviar os formatos da API.
- Tratar campos de data e horário como valores locais, evitando conversão automática para UTC.
- Desabilitar confirmação enquanto a reserva estiver sendo enviada.
- Se o horário for ocupado durante a confirmação, atualizar a disponibilidade e pedir nova seleção.
- Não exibir sucesso antes de validar a resposta.
- Planejar navegação por tipo de usuário após a API passar a retorná-lo.
- Tratar autenticação expirada, conexão indisponível e ausência de serviços.
- Não usar bloqueio visual de botões como substituto das permissões do servidor.

## Pendências do backend

| Problema observado | Ajuste necessário |
| --- | --- |
| Clientes são barrados de criar/listar/cancelar reservas | Permissões por ação e por proprietário |
| Barbeiros acessam objetos de outras contas | Filtrar querysets e verificar propriedade nas operações |
| Perfil permite escrita pública e `/me/` usa `AllowAny` | Exigir autenticação, restringir ao próprio perfil e usar serializers de escrita |
| Métodos personalizados `patch`/`delete` não são ações do router | Implementar `partial_update`/`destroy` ou usar os hooks adequados |
| Serviço não recebe `Barbearia` na criação | Serializer de escrita com relação e autorização do dono |
| `/me/` omite `TipoUsuario` e CPF | Definir campos necessários para o contrato de perfil |
| Agenda e unicidade são globais por data/horário | Modelar estabelecimento/profissional e alterar consulta e restrição do banco |
| Validador de 20 minutos só existe no modelo | Validar na criação via serializer ou validação explícita; `objects.create()` não chama `full_clean()` |
| Reserva não respeita expediente, duração ou datas passadas | Validações de negócio no servidor |
| Serviços inexistentes e concorrência podem gerar erros não tratados | Validar relações e tratar conflito de integridade |
| Cadastro não valida duplicidade de forma efetiva nem usa transação | Serializer de entrada, validações e criação atômica |
| Corpo e status HTTP divergem | Padronizar sucesso e erros com status HTTP corretos |
| Cancelamento apaga dados | Adicionar status e histórico caso seja necessário manter rastreabilidade |
| JWT sem ciclo completo de sessão | Revisar expiração, logout e revogação |
| Sem documentação OpenAPI publicada | Configurar schema e interface de documentação |

Os itens acima são constatações da revisão do código, não correções implementadas nesta documentação.

## Verificação e publicação

### Comandos úteis

```bash
POSTGRES_PORT=5433 USE_SQLITE=0 .venv/bin/python barber/manage.py check
POSTGRES_PORT=5433 USE_SQLITE=0 .venv/bin/python barber/manage.py showmigrations
POSTGRES_PORT=5433 USE_SQLITE=0 .venv/bin/python barber/manage.py test Usuario barbshop service scheduling
curl -i http://localhost:8000/barbshop/
```

Os arquivos de teste dos apps ainda não contêm casos de negócio; executar o runner sem falhas não comprova os fluxos de reserva ou autorização. A documentação foi baseada na leitura de modelos, serializers, views e configurações, com conferência do mapeamento de ações do router. Os exemplos JSON são ilustrativos; não representam dados pré-carregados nem uma validação completa de todos os endpoints.

### Produção

A configuração atual é de desenvolvimento: `DEBUG=True`, chave secreta fixa, credenciais locais e `ALLOWED_HOSTS` vazio. Antes de publicar, externalizar configurações, resolver as pendências de acesso e validação, definir domínio/HTTPS, arquivos estáticos, backup do banco e executar testes dos fluxos principais.

O Gunicorn está instalado. Após preparar o ambiente e a configuração de produção, o ponto de entrada WSGI é:

```bash
cd barber
../.venv/bin/gunicorn barber.wsgi:application --bind 0.0.0.0:8000
```

Esse comando sozinho não configura um deploy público nem substitui os ajustes de produção.
