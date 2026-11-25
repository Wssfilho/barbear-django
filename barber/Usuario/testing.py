"""Utilitários compartilhados pelos testes dos apps."""
from datetime import time

from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import Usuario

SENHA = 'Senha-forte-123'


def criar_usuario(username, tipo=Usuario.CLIENTE, nome=None):
    user = User.objects.create_user(username=username, password=SENHA, first_name=nome or username.title(),
                                    email=f'{username}@example.com')
    return Usuario.objects.create(Vinculado=user, Telefone='71999999999', cpf='12345678901', TipoUsuario=tipo)


def criar_barbearia(dono, nome='Barbearia'):
    from barbshop.models import BarberShop
    return BarberShop.objects.create(
        Dono=dono, Nome=nome, Endereco='Rua A, 1', Telefone='71999999999', Email='b@example.com',
        horario_abertura=time(8), horario_fechamento=time(18),
    )


def criar_servico(barbearia, nome='Corte', preco='50.00'):
    from service.models import Service
    return Service.objects.create(Barbearia=barbearia, Nome=nome, Descricao='Desc', Preco=preco)


def cliente_api(usuario=None):
    api = APIClient()
    if usuario is not None:
        response = api.post('/api/token/', {'username': usuario.Vinculado.username, 'password': SENHA}, format='json')
        assert response.status_code == 200, response.content
        api.credentials(HTTP_AUTHORIZATION='Bearer ' + response.data['access'])
    return api
