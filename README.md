# 💈 Barbear Django - Sistema de Gerenciamento de Barbearias

## 📋 Descrição

Sistema completo de gerenciamento de barbearias desenvolvido em Django Rest Framework. A aplicação permite o cadastro de barbearias, serviços oferecidos, gerenciamento de usuários (clientes e barbeiros) e agendamentos com sistema de horários disponíveis.

### ✨ Funcionalidades Principais

- 🔐 Autenticação JWT (JSON Web Token)
- 👥 Gestão de usuários (Clientes e Barbeiros)
- 🏪 Gerenciamento de barbearias
- ✂️ Cadastro e controle de serviços
- 📅 Sistema de agendamentos com validação de horários
- ⏰ Verificação automática de horários disponíveis
- 🛡️ Sistema de permissões diferenciadas por tipo de usuário

## 🛠️ Tecnologias Utilizadas

- **Python** 3.x
- **Django** 5.2
- **Django Rest Framework** 3.16.0
- **PostgreSQL** (psycopg2-binary)
- **JWT Authentication** (djangorestframework-simplejwt)
- **CORS Headers** (django-cors-headers)
- **Swagger/OpenAPI** (drf-yasg)
- **Gunicorn** (servidor WSGI)

## 📦 Instalação

### Pré-requisitos

- Python 3.8 ou superior
- PostgreSQL
- pip (gerenciador de pacotes Python)

### Passo a Passo

1. **Clone o repositório**

```bash
git clone <url-do-repositorio>
cd barbear-django
```

2. **Crie um ambiente virtual**

```bash
python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
```

3. **Instale as dependências**

```bash
pip install -r requirements.txt
```

4. **Configure o banco de dados**

Edite o arquivo `barber/barber/settings.py` com suas credenciais do PostgreSQL:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'seu_banco',
        'USER': 'seu_usuario',
        'PASSWORD': 'sua_senha',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

5. **Execute as migrações**

```bash
cd barber
python manage.py migrate
```

6. **Crie um superusuário (opcional)**

```bash
python manage.py createsuperuser
```

7. **Inicie o servidor**

```bash
python manage.py runserver
```

O servidor estará disponível em: `http://localhost:8000`

## 🔑 Autenticação

O sistema utiliza JWT (JSON Web Token) para autenticação. Para acessar endpoints protegidos, é necessário incluir o token no header das requisições.

### Obter Token

**Endpoint:** `POST /api/token/`

**Body:**

```json
{
  "username": "seu_usuario",
  "password": "sua_senha"
}
```

**Resposta:**

```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Atualizar Token

**Endpoint:** `POST /api/token/refresh/`

**Body:**

```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Resposta:**

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Uso do Token

Inclua o token de acesso no header de suas requisições:

```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## 📚 Documentação da API

### 👤 Usuários (`/usuario/`)

#### Listar Todos os Usuários

- **Método:** `GET`
- **Endpoint:** `/usuario/`
- **Permissões:** Requer autenticação + Barbeiro
- **Resposta de Sucesso:**

```json
{
  "status": 302,
  "Usuario": [
    {
      "id": 1,
      "Vinculado": {
        "username": "usuario1",
        "first_name": "João",
        "email": "joao@email.com"
      },
      "Telefone": "11999999999",
      "cpf": "12345678901",
      "TipoUsuario": 1
    }
  ]
}
```

#### Criar Usuário

- **Método:** `POST`
- **Endpoint:** `/usuario/`
- **Permissões:** Público (AllowAny)
- **Body:**

```json
{
  "username": "novousuario",
  "password": "senha123",
  "first_name": "João",
  "email": "joao@email.com",
  "telefone": "11999999999",
  "cpf": "12345678901",
  "tipo_usuario": 1
}
```

- **Resposta de Sucesso:**

```json
{
  "status": 201,
  "msg": "User registered successfully"
}
```

#### Obter Usuário Autenticado

- **Método:** `GET`
- **Endpoint:** `/usuario/me/`
- **Permissões:** Público (AllowAny)
- **Resposta:**

```json
{
  "status": 302,
  "Usuario": {
    "id": 1,
    "Vinculado": {
      "username": "usuario1",
      "first_name": "João",
      "email": "joao@email.com"
    },
    "Telefone": "11999999999",
    "cpf": "12345678901",
    "TipoUsuario": 1
  }
}
```

#### Atualizar Usuário

- **Método:** `PATCH`
- **Endpoint:** `/usuario/{id}/`
- **Permissões:** Público (AllowAny)
- **Body:**

```json
{
  "first_name": "João Silva",
  "email": "joao.silva@email.com",
  "telefone": "11988888888",
  "cpf": "12345678901"
}
```

- **Resposta:**

```json
{
  "status": 200,
  "msg": "User updated successfully"
}
```

#### Deletar Usuário

- **Método:** `DELETE`
- **Endpoint:** `/usuario/?id=1`
- **Permissões:** Público (AllowAny)
- **Resposta:**

```json
{
  "status": 200,
  "msg": "User deleted successfully"
}
```

**Nota sobre Tipos de Usuário:**

- `1` = Cliente
- `2` = Barbeiro

---

### 🏪 Barbearias (`/barbshop/`)

#### Listar Todas as Barbearias

- **Método:** `GET`
- **Endpoint:** `/barbshop/`
- **Permissões:** Público (AllowAny)
- **Resposta:**

```json
{
  "status": 200,
  "barbershops": [
    {
      "id": 1,
      "Nome": "Barbearia Top",
      "Endereco": "Rua das Flores, 123",
      "Telefone": "11999999999",
      "Email": "contato@barbeariatop.com",
      "horario_abertura": "08:00:00",
      "horario_fechamento": "18:00:00",
      "Dono": 2
    }
  ]
}
```

#### Criar Barbearia

- **Método:** `POST`
- **Endpoint:** `/barbshop/`
- **Permissões:** Autenticado + Barbeiro
- **Body:**

```json
{
  "Nome": "Barbearia Top",
  "Endereco": "Rua das Flores, 123",
  "Telefone": "11999999999",
  "Email": "contato@barbeariatop.com",
  "horario_abertura": "08:00",
  "horario_fechamento": "18:00"
}
```

- **Resposta:**

```json
{
  "status": 201,
  "message": "Barbearia criada com sucesso.",
  "barbshop_id": 1
}
```

#### Atualizar Barbearia

- **Método:** `PUT`
- **Endpoint:** `/barbshop/{id}/`
- **Permissões:** Autenticado + Barbeiro (apenas dono)
- **Body:**

```json
{
  "Nome": "Barbearia Premium",
  "Endereco": "Rua das Flores, 123",
  "Telefone": "11988888888",
  "Email": "novo@barbeariatop.com",
  "horario_abertura": "09:00",
  "horario_fechamento": "19:00"
}
```

- **Resposta:**

```json
{
  "status": 200,
  "message": "Barbearia atualizada com sucesso."
}
```

#### Deletar Barbearia

- **Método:** `DELETE`
- **Endpoint:** `/barbshop/{id}/`
- **Permissões:** Autenticado + Barbeiro (apenas dono)
- **Resposta:**

```json
{
  "status": 200,
  "message": "Barbearia deletada com sucesso."
}
```

---

### ✂️ Serviços (`/service/`)

#### Listar Serviços de uma Barbearia

- **Método:** `GET`
- **Endpoint:** `/service/?id={barbshop_id}`
- **Permissões:** Público (AllowAny)
- **Resposta:**

```json
{
  "status": 200,
  "services": [
    {
      "id": 1,
      "Nome": "Corte de Cabelo",
      "Descricao": "Corte tradicional",
      "Preco": "30.00",
      "Barbearia": 1
    },
    {
      "id": 2,
      "Nome": "Barba",
      "Descricao": "Aparar e modelar barba",
      "Preco": "25.00",
      "Barbearia": 1
    }
  ]
}
```

#### Atualizar Serviço

- **Método:** `PATCH`
- **Endpoint:** `/service/{id}/`
- **Permissões:** Autenticado + Barbeiro
- **Body:**

```json
{
  "Nome": "Corte Premium",
  "Descricao": "Corte diferenciado",
  "Preco": "45.00"
}
```

- **Resposta:**

```json
{
  "status": 200,
  "message": "Serviço atualizado com sucesso."
}
```

#### Deletar Serviço

- **Método:** `DELETE`
- **Endpoint:** `/service/{id}/`
- **Permissões:** Autenticado + Barbeiro
- **Resposta:**

```json
{
  "status": 200,
  "message": "Serviço deletado com sucesso."
}
```

---

### 📅 Agendamentos (`/scheduling/`)

#### Listar Agendamentos do Usuário

- **Método:** `GET`
- **Endpoint:** `/scheduling/`
- **Permissões:** Autenticado + Barbeiro
- **Resposta:**

```json
[
  {
    "id": 1,
    "cliente": {
      "id": 1,
      "nome": "João Silva"
    },
    "servico": {
      "id": 1,
      "Nome": "Corte de Cabelo",
      "Preco": "30.00"
    },
    "descricao": "Corte social",
    "data_agendamento": "2026-02-15",
    "horario_agendamento": "14:00:00"
  }
]
```

#### Verificar Horários Disponíveis

- **Método:** `GET`
- **Endpoint:** `/scheduling/available_times/?date=YYYY-MM-DD`
- **Permissões:** Público (AllowAny)
- **Exemplo:** `/scheduling/available_times/?date=2026-02-15`
- **Resposta:**

```json
{
  "date": "2026-02-15",
  "available_times": [
    "08:00",
    "08:20",
    "08:40",
    "09:00",
    "09:20",
    "09:40",
    "10:00"
  ]
}
```

**Observações:**

- Os horários são gerados em intervalos de 20 minutos
- Horário de funcionamento padrão: 08:00 às 18:00
- Horários já agendados são automaticamente removidos da lista

#### Criar Agendamento

- **Método:** `POST`
- **Endpoint:** `/scheduling/`
- **Permissões:** Autenticado + Barbeiro
- **Body:**

```json
{
  "servico": 1,
  "data_agendamento": "2026-02-15",
  "horario_agendamento": "14:00",
  "descricao": "Corte social"
}
```

- **Resposta de Sucesso:**

```json
{
  "message": "Agendamento criado com sucesso",
  "scheduling": {
    "id": 1,
    "cliente": {
      "id": 1,
      "nome": "João Silva"
    },
    "servico": {
      "id": 1,
      "Nome": "Corte de Cabelo",
      "Preco": "30.00"
    },
    "descricao": "Corte social",
    "data_agendamento": "2026-02-15",
    "horario_agendamento": "14:00:00"
  }
}
```

- **Resposta de Erro (horário indisponível):**

```json
{
  "error": "Horario indisponivel para agendamento"
}
```

#### Cancelar Agendamento

- **Método:** `DELETE`
- **Endpoint:** `/scheduling/{id}/`
- **Permissões:** Autenticado
- **Resposta:**

```json
{
  "message": "Agendamento cancelado com sucesso"
}
```

---

## 🔒 Sistema de Permissões

### Tipos de Usuário

1. **Cliente (TipoUsuario = 1)**
   - Pode criar conta
   - Pode visualizar barbearias e serviços
   - Pode criar agendamentos (se for barbeiro)
   - Pode visualizar horários disponíveis

2. **Barbeiro (TipoUsuario = 2)**
   - Todas as permissões de Cliente
   - Pode criar, editar e deletar barbearias (apenas as suas)
   - Pode gerenciar serviços
   - Pode visualizar todos os agendamentos
   - Acesso completo ao sistema

### Endpoints Públicos (sem autenticação)

- `POST /api/token/` - Obter token
- `POST /api/token/refresh/` - Atualizar token
- `POST /usuario/` - Criar usuário
- `GET /barbshop/` - Listar barbearias
- `GET /service/?id={id}` - Listar serviços
- `GET /scheduling/available_times/` - Horários disponíveis

## 📝 Regras de Negócio

### Agendamentos

1. **Intervalos de Tempo:** Todos os agendamentos devem ser em intervalos de 20 minutos (08:00, 08:20, 08:40, etc.)
2. **Unicidade:** Não é possível ter dois agendamentos no mesmo horário e data
3. **Validação:** O sistema valida automaticamente se o horário está disponível antes de criar o agendamento
4. **Horário de Funcionamento:** Por padrão, o sistema opera das 08:00 às 18:00

### Barbearias

1. Apenas barbeiros (TipoUsuario = 2) podem criar barbearias
2. Apenas o dono pode editar ou deletar sua barbearia
3. Todos os campos são obrigatórios

### Serviços

1. Serviços devem estar vinculados a uma barbearia
2. Apenas barbeiros podem gerenciar serviços
3. Preço em formato decimal com 2 casas decimais

## 🗂️ Estrutura do Projeto

```
barber/
├── barber/              # Configurações principais do Django
│   ├── settings.py      # Configurações do projeto
│   ├── urls.py          # Rotas principais
│   └── wsgi.py          # Configuração WSGI
├── barbshop/            # App de barbearias
│   ├── models.py        # Modelo BarberShop
│   ├── views.py         # ViewSet de barbearias
│   ├── serializer.py    # Serializers
│   └── permissions.py   # Permissão IsBarbeiro
├── Usuario/             # App de usuários
│   ├── models.py        # Modelo Usuario
│   ├── views.py         # ViewSet de usuários
│   └── serializer.py    # Serializers
├── service/             # App de serviços
│   ├── models.py        # Modelo Service
│   ├── views.py         # ViewSet de serviços
│   └── serializer.py    # Serializers
├── scheduling/          # App de agendamentos
│   ├── models.py        # Modelo Scheduling
│   ├── views.py         # ViewSet de agendamentos
│   └── serializer.py    # Serializers
└── manage.py            # CLI do Django
```

## 🧪 Testando a API

### Exemplo com cURL

#### 1. Criar um usuário

```bash
curl -X POST http://localhost:8000/usuario/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "joao",
    "password": "senha123",
    "first_name": "João Silva",
    "email": "joao@email.com",
    "telefone": "11999999999",
    "cpf": "12345678901",
    "tipo_usuario": 2
  }'
```

#### 2. Obter token

```bash
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "joao",
    "password": "senha123"
  }'
```

#### 3. Criar barbearia (com token)

```bash
curl -X POST http://localhost:8000/barbshop/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "Nome": "Barbearia Top",
    "Endereco": "Rua das Flores, 123",
    "Telefone": "11999999999",
    "Email": "contato@barbeariatop.com",
    "horario_abertura": "08:00",
    "horario_fechamento": "18:00"
  }'
```

#### 4. Verificar horários disponíveis

```bash
curl -X GET "http://localhost:8000/scheduling/available_times/?date=2026-02-15"
```

### Exemplo com Python (requests)

```python
import requests

# Base URL
BASE_URL = "http://localhost:8000"

# 1. Criar usuário
response = requests.post(f"{BASE_URL}/usuario/", json={
    "username": "joao",
    "password": "senha123",
    "first_name": "João Silva",
    "email": "joao@email.com",
    "telefone": "11999999999",
    "cpf": "12345678901",
    "tipo_usuario": 2
})
print(response.json())

# 2. Obter token
response = requests.post(f"{BASE_URL}/api/token/", json={
    "username": "joao",
    "password": "senha123"
})
token = response.json()["access"]

# 3. Headers com autenticação
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# 4. Criar barbearia
response = requests.post(f"{BASE_URL}/barbshop/", headers=headers, json={
    "Nome": "Barbearia Top",
    "Endereco": "Rua das Flores, 123",
    "Telefone": "11999999999",
    "Email": "contato@barbeariatop.com",
    "horario_abertura": "08:00",
    "horario_fechamento": "18:00"
})
print(response.json())

# 5. Listar horários disponíveis
response = requests.get(f"{BASE_URL}/scheduling/available_times/?date=2026-02-15")
print(response.json())
```

## 🚀 Deploy

### Produção com Gunicorn

O projeto já inclui o Gunicorn nas dependências. Para executar em produção:

```bash
gunicorn barber.wsgi:application --bind 0.0.0.0:8000
```

### Variáveis de Ambiente Recomendadas

Crie um arquivo `.env` na raiz do projeto:

```env
SECRET_KEY=sua_chave_secreta_aqui
DEBUG=False
ALLOWED_HOSTS=seudominio.com,www.seudominio.com
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_banco
```

## 📄 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.

## 👥 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um Fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abrir um Pull Request

## 📞 Suporte

Para reportar bugs ou solicitar novas funcionalidades, abra uma issue no repositório.

---

**Desenvolvido com ❤️ usando Django Rest Framework**
