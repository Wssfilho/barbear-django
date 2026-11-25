from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from Usuario.models import Usuario


class Command(BaseCommand):
    help = (
        'Cria uma conta de barbeiro ou promove um usuário existente a barbeiro. '
        'O cadastro público da API cria apenas clientes.'
    )

    def add_arguments(self, parser):
        parser.add_argument('username')
        parser.add_argument('--password', help='Obrigatória ao criar um novo usuário.')
        parser.add_argument('--nome', default='', help='Primeiro nome exibido aos clientes.')
        parser.add_argument('--email', default='')
        parser.add_argument('--telefone', default='00000000000')

    @transaction.atomic
    def handle(self, username, password, nome, email, telefone, **options):
        user = User.objects.filter(username=username).first()
        if user is None:
            if not password:
                raise CommandError('Informe --password para criar um novo usuário.')
            user = User.objects.create_user(username=username, password=password, email=email, first_name=nome)
        elif nome:
            user.first_name = nome
            user.save(update_fields=['first_name'])
        usuario, created = Usuario.objects.get_or_create(
            Vinculado=user, defaults={'Telefone': telefone, 'TipoUsuario': Usuario.BARBEIRO})
        if not created and not usuario.is_barbeiro:
            usuario.TipoUsuario = Usuario.BARBEIRO
            usuario.save(update_fields=['TipoUsuario'])
        self.stdout.write(self.style.SUCCESS(f'Barbeiro pronto: {user.username} (perfil {usuario.id}).'))
