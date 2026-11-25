from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from Usuario.models import Usuario
from barbshop.models import BarberShop
from scheduling.models import Scheduling
from service.models import Service


class RoleAPITestCase(APITestCase):
    """Real database fixtures for accounts and two independent businesses."""

    @classmethod
    def setUpTestData(cls):
        cls.password = 'Barbear-tests-42!'
        cls.customer = cls.make_profile('cliente', 1)
        cls.other_customer = cls.make_profile('outro-cliente', 1)
        cls.barber = cls.make_profile('barbeiro', 2)
        cls.other_barber = cls.make_profile('outro-barbeiro', 2)
        cls.shop = cls.make_shop(cls.barber, 'Primeira barbearia')
        cls.other_shop = cls.make_shop(cls.other_barber, 'Segunda barbearia')
        cls.service = cls.make_service(cls.shop)
        cls.other_service = cls.make_service(cls.other_shop)
        cls.date = timezone.localdate() + timedelta(days=7)

    @classmethod
    def make_profile(cls, username, role):
        user = User.objects.create_user(
            username=username, password=cls.password,
            first_name=username, email=f'{username}@example.com',
        )
        return Usuario.objects.create(
            Vinculado=user, TipoUsuario=role,
            Telefone='71999999999', cpf='12345678901',
        )

    @classmethod
    def make_shop(cls, owner, name):
        return BarberShop.objects.create(
            Dono=owner, Nome=name, Endereco='Rua de testes, 10',
            Telefone='71999999999', Email='loja@example.com',
            horario_abertura='08:00', horario_fechamento='18:00',
        )

    @classmethod
    def make_service(cls, shop):
        return Service.objects.create(
            Barbearia=shop, Nome='Corte', Descricao='Corte de cabelo', Preco='35.00',
        )

    def sign_in(self, profile):
        self.client.force_authenticate(user=profile.Vinculado)

    def make_booking(self, customer=None, service=None, time='10:00'):
        selected_service = service or self.service
        return Scheduling.objects.create(
            cliente=customer or self.customer,
            servico=selected_service,
            barbeiro=selected_service.Barbearia.Dono,
            data_agendamento=self.date, horario_agendamento=time,
        )

    def booking_payload(self, service=None, time='10:00'):
        return {
            'servico': (service or self.service).pk,
            'data_agendamento': self.date.isoformat(),
            'horario_agendamento': time,
            'descricao': 'Reserva de teste',
        }

    def response_items(self, response, *keys):
        data = response.data
        if isinstance(data, list):
            return data
        for key in (*keys, 'results'):
            if key in data:
                return data[key]
        self.fail(f'Expected a collection in the API response: {data}')
