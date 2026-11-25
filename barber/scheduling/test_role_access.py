from datetime import datetime, time
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone

from Usuario.models import Usuario
from barbshop.models import BarberShop
from scheduling.models import Scheduling
from service.models import Service
from test_support import RoleAPITestCase


class AccountRoleTests(RoleAPITestCase):
    def test_profile_requires_authentication(self):
        response = self.client.get('/usuario/me/')
        self.assertEqual(response.status_code, 401)

    def test_authenticated_profile_includes_role(self):
        for profile in (self.customer, self.barber):
            with self.subTest(role=profile.TipoUsuario):
                self.sign_in(profile)
                response = self.client.get('/usuario/me/')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['Usuario']['tipo_usuario'], profile.TipoUsuario)
                self.assertEqual(response.data['Usuario']['perfil'], 'cliente' if profile.TipoUsuario == 1 else 'barbeiro')

    def test_public_registration_creates_customer(self):
        response = self.client.post('/usuario/', {
            'username': 'novo-cliente', 'password': self.password,
            'first_name': 'Cliente', 'email': 'novo@example.com',
            'telefone': '71999999999', 'cpf': '98765432100',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        profile = Usuario.objects.get(Vinculado__username='novo-cliente')
        self.assertEqual(profile.TipoUsuario, 1)
        self.assertTrue(profile.Vinculado.check_password(self.password))

    def test_public_registration_cannot_request_barber_or_staff_privileges(self):
        response = self.client.post('/usuario/', {
            'username': 'tentativa-privilegio', 'password': self.password,
            'first_name': 'Cliente', 'email': 'novo@example.com',
            'telefone': '71999999999', 'cpf': '98765432100',
            'tipo_usuario': 2, 'TipoUsuario': 2, 'is_staff': True, 'is_superuser': True,
        }, format='json')
        self.assertIn(response.status_code, (201, 400, 403))
        user = User.objects.filter(username='tentativa-privilegio').first()
        if user:
            self.assertFalse(user.is_staff)
            self.assertFalse(user.is_superuser)
            self.assertEqual(Usuario.objects.get(Vinculado=user).TipoUsuario, 1)

    def test_duplicate_username_is_validation_error(self):
        response = self.client.post('/usuario/', {
            'username': self.customer.Vinculado.username, 'password': self.password,
            'first_name': 'Outro', 'email': 'outro@example.com',
            'telefone': '71999999999', 'cpf': '98765432100',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_anonymous_cannot_change_or_delete_account(self):
        path = f'/usuario/{self.customer.pk}/'
        for method, payload in (('patch', {'TipoUsuario': 2}), ('put', {}), ('delete', {})):
            with self.subTest(method=method):
                response = getattr(self.client, method)(path, payload, format='json')
                self.assertEqual(response.status_code, 401)
        self.assertTrue(Usuario.objects.filter(pk=self.customer.pk).exists())

    def test_customer_cannot_change_another_profile(self):
        self.sign_in(self.customer)
        response = self.client.patch(f'/usuario/{self.other_customer.pk}/', {
            'Telefone': '71000000000', 'TipoUsuario': 2,
        }, format='json')
        self.assertIn(response.status_code, (403, 404, 405))
        self.other_customer.refresh_from_db()
        self.assertEqual(self.other_customer.Telefone, '71999999999')
        self.assertEqual(self.other_customer.TipoUsuario, 1)

    def test_jwt_login_authenticates_requests(self):
        response = self.client.post('/api/token/', {
            'username': self.customer.Vinculado.username,
            'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('refresh', response.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        response = self.client.get('/usuario/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['Usuario']['id'], self.customer.pk)

    def test_customer_cannot_list_private_customer_directory(self):
        self.sign_in(self.customer)
        response = self.client.get('/usuario/')
        self.assertIn(response.status_code, (403, 405))

    def test_each_login_accepts_its_expected_role(self):
        for role, profile in (('cliente', self.customer), ('barbeiro', self.barber)):
            with self.subTest(role=role):
                response = self.client.post(f'/api/token/{role}/', {
                    'username': profile.Vinculado.username, 'password': self.password,
                }, format='json')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['perfil'], role)
                self.assertIn('access', response.data)
                self.assertIn('refresh', response.data)

    def test_each_login_rejects_the_other_role_without_tokens(self):
        for role, profile in (('cliente', self.barber), ('barbeiro', self.customer)):
            with self.subTest(role=role):
                response = self.client.post(f'/api/token/{role}/', {
                    'username': profile.Vinculado.username, 'password': self.password,
                }, format='json')
                self.assertEqual(response.status_code, 403)
                self.assertNotIn('access', response.data)
                self.assertNotIn('refresh', response.data)

    def test_role_login_rejects_wrong_password(self):
        response = self.client.post('/api/token/barbeiro/', {
            'username': self.barber.Vinculado.username, 'password': 'senha-incorreta',
        }, format='json')
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('access', response.data)

    def test_account_without_business_profile_cannot_log_in(self):
        User.objects.create_user(username='sem-perfil', password=self.password)
        for endpoint in ('/api/token/', '/api/token/cliente/', '/api/token/barbeiro/'):
            with self.subTest(endpoint=endpoint):
                response = self.client.post(endpoint, {
                    'username': 'sem-perfil', 'password': self.password,
                }, format='json')
                self.assertEqual(response.status_code, 403)
                self.assertNotIn('access', response.data)

    def test_existing_jwt_does_not_preserve_revoked_barber_privileges(self):
        response = self.client.post('/api/token/barbeiro/', {
            'username': self.barber.Vinculado.username, 'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        Usuario.objects.filter(pk=self.barber.pk).update(TipoUsuario=1)
        response = self.client.post('/service/', {
            'Barbearia': self.shop.pk,
            'Nome': 'Sem permissão', 'Descricao': 'Teste', 'Preco': '25.00',
        }, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Service.objects.filter(Nome='Sem permissão').exists())

    def test_public_barber_directory_exposes_no_private_customer_data(self):
        response = self.client.get('/usuario/barbeiros/')
        self.assertEqual(response.status_code, 200)
        items = self.response_items(response, 'barbeiros')
        self.assertEqual({item['id'] for item in items}, {self.barber.pk, self.other_barber.pk})
        for item in items:
            self.assertNotIn('cpf', item)
            self.assertNotIn('Vinculado', item)
        self.assertNotIn(self.customer.Vinculado.email, response.content.decode())

    def test_barber_sees_only_customers_with_bookings_in_own_business(self):
        self.make_booking()
        self.make_booking(customer=self.customer, time='10:20')
        self.make_booking(customer=self.other_customer, service=self.other_service, time='11:00')
        self.sign_in(self.barber)
        response = self.client.get('/usuario/')
        self.assertEqual(response.status_code, 200)
        items = self.response_items(response, 'Usuario')
        self.assertEqual([item['id'] for item in items], [self.customer.pk])
        self.assertEqual(items[0]['total_agendamentos'], 2)
        self.assertNotIn('cpf', items[0])

    def test_barber_cannot_retrieve_customer_from_another_business(self):
        self.make_booking(customer=self.other_customer, service=self.other_service)
        self.sign_in(self.barber)
        response = self.client.get(f'/usuario/{self.other_customer.pk}/')
        self.assertEqual(response.status_code, 404)

    def test_customer_can_update_own_details_without_changing_role(self):
        self.sign_in(self.customer)
        response = self.client.patch('/usuario/me/', {
            'first_name': 'Nome atualizado', 'telefone': '71988888888',
            'TipoUsuario': 2, 'tipo_usuario': 2, 'is_staff': True,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.customer.Vinculado.refresh_from_db()
        self.assertEqual(self.customer.TipoUsuario, 1)
        self.assertEqual(self.customer.Telefone, '71988888888')
        self.assertEqual(self.customer.Vinculado.first_name, 'Nome atualizado')
        self.assertFalse(self.customer.Vinculado.is_staff)


class BookingRoleTests(RoleAPITestCase):
    def test_anonymous_cannot_read_create_or_delete_bookings(self):
        booking = self.make_booking()
        responses = (
            self.client.get('/scheduling/'),
            self.client.post('/scheduling/', self.booking_payload(time='11:00'), format='json'),
            self.client.delete(f'/scheduling/{booking.pk}/'),
        )
        for response in responses:
            self.assertEqual(response.status_code, 401)
        self.assertTrue(Scheduling.objects.filter(pk=booking.pk).exists())

    def test_customer_creates_booking_for_self_even_with_another_client_in_payload(self):
        self.sign_in(self.customer)
        payload = {**self.booking_payload(), 'cliente': self.other_customer.pk}
        response = self.client.post('/scheduling/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Scheduling.objects.get().cliente_id, self.customer.pk)

    def test_customer_list_contains_only_own_bookings(self):
        own = self.make_booking()
        self.make_booking(customer=self.other_customer, time='11:00')
        self.sign_in(self.customer)
        response = self.client.get('/scheduling/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in self.response_items(response, 'scheduling')], [own.pk])

    def test_customer_can_cancel_own_booking(self):
        booking = self.make_booking()
        self.sign_in(self.customer)
        response = self.client.delete(f'/scheduling/{booking.pk}/')
        self.assertIn(response.status_code, (200, 204))
        self.assertFalse(Scheduling.objects.filter(pk=booking.pk).exists())

    def test_customer_cannot_retrieve_change_or_cancel_another_booking(self):
        booking = self.make_booking(customer=self.other_customer)
        self.sign_in(self.customer)
        path = f'/scheduling/{booking.pk}/'
        for method, payload in (('get', {}), ('patch', {'descricao': 'alterada'}), ('delete', {})):
            with self.subTest(method=method):
                response = getattr(self.client, method)(path, payload, format='json')
                self.assertIn(response.status_code, (403, 404, 405))
        booking.refresh_from_db()
        self.assertIsNone(booking.descricao)

    def test_barber_list_contains_bookings_from_own_business_only(self):
        own = self.make_booking()
        self.make_booking(service=self.other_service, time='11:00')
        self.sign_in(self.barber)
        response = self.client.get('/scheduling/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in self.response_items(response, 'scheduling')], [own.pk])

    def test_barber_cannot_retrieve_change_or_cancel_other_business_booking(self):
        booking = self.make_booking(service=self.other_service)
        self.sign_in(self.barber)
        path = f'/scheduling/{booking.pk}/'
        for method, payload in (('get', {}), ('patch', {'descricao': 'alterada'}), ('delete', {})):
            with self.subTest(method=method):
                response = getattr(self.client, method)(path, payload, format='json')
                self.assertIn(response.status_code, (403, 404, 405))
        self.assertTrue(Scheduling.objects.filter(pk=booking.pk).exists())

    def test_same_business_cannot_be_double_booked_at_same_time(self):
        self.make_booking()
        self.sign_in(self.other_customer)
        response = self.client.post('/scheduling/', self.booking_payload(), format='json')
        self.assertIn(response.status_code, (400, 409))
        self.assertEqual(Scheduling.objects.count(), 1)

    def test_different_services_in_same_business_share_availability(self):
        self.make_booking()
        second_service = self.make_service(self.shop)
        self.sign_in(self.other_customer)
        response = self.client.post('/scheduling/', self.booking_payload(service=second_service), format='json')
        self.assertIn(response.status_code, (400, 409))
        self.assertEqual(Scheduling.objects.count(), 1)

    def test_barber_can_cancel_own_business_booking(self):
        booking = self.make_booking()
        self.sign_in(self.barber)
        response = self.client.delete(f'/scheduling/{booking.pk}/')
        self.assertIn(response.status_code, (200, 204))
        self.assertFalse(Scheduling.objects.filter(pk=booking.pk).exists())

    def test_different_businesses_can_book_same_time(self):
        self.make_booking()
        self.sign_in(self.other_customer)
        response = self.client.post('/scheduling/', self.booking_payload(service=self.other_service), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Scheduling.objects.count(), 2)

    def test_invalid_booking_times_and_dates_do_not_create_records(self):
        self.sign_in(self.customer)
        for changes in (
            {'horario_agendamento': '10:13'},
            {'horario_agendamento': '07:40'},
            {'horario_agendamento': '18:20'},
            {'data_agendamento': '2001-01-01'},
            {'data_agendamento': 'invalid'},
            {'servico': 999999},
        ):
            with self.subTest(changes=changes):
                response = self.client.post('/scheduling/', {**self.booking_payload(), **changes}, format='json')
                self.assertIn(response.status_code, (400, 404))
        self.assertFalse(Scheduling.objects.exists())


class BusinessRoleTests(RoleAPITestCase):
    def test_customer_can_browse_shops_and_services(self):
        self.sign_in(self.customer)
        response = self.client.get('/barbshop/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual({item['id'] for item in self.response_items(response, 'barbershops')}, {self.shop.pk, self.other_shop.pk})
        response = self.client.get('/service/', {'id': self.shop.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in self.response_items(response, 'services')], [self.service.pk])

    def test_customer_cannot_create_shop_or_service(self):
        self.sign_in(self.customer)
        self.assertEqual(self.client.post('/barbshop/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.post('/service/', {}, format='json').status_code, 403)

    def test_customer_cannot_modify_or_delete_shops_and_services(self):
        self.sign_in(self.customer)
        for path in (f'/barbshop/{self.shop.pk}/', f'/service/{self.service.pk}/'):
            for method in ('patch', 'delete'):
                with self.subTest(path=path, method=method):
                    response = getattr(self.client, method)(path, {'Nome': 'alterado'}, format='json')
                    self.assertIn(response.status_code, (403, 405))
        self.assertTrue(BarberShop.objects.filter(pk=self.shop.pk).exists())
        self.assertTrue(Service.objects.filter(pk=self.service.pk).exists())

    def test_barber_cannot_modify_or_delete_other_business(self):
        self.sign_in(self.barber)
        for path in (f'/barbshop/{self.other_shop.pk}/', f'/service/{self.other_service.pk}/'):
            for method in ('patch', 'delete'):
                with self.subTest(path=path, method=method):
                    response = getattr(self.client, method)(path, {'Nome': 'alterado'}, format='json')
                    self.assertIn(response.status_code, (403, 404))
        self.other_shop.refresh_from_db()
        self.other_service.refresh_from_db()
        self.assertEqual(self.other_shop.Nome, 'Segunda barbearia')
        self.assertEqual(self.other_service.Nome, 'Corte')

    def test_barber_cannot_create_service_in_other_business(self):
        self.sign_in(self.barber)
        response = self.client.post('/service/', {
            'Barbearia': self.other_shop.pk,
            'Nome': 'Invasor', 'Descricao': 'Não autorizado', 'Preco': '10.00',
        }, format='json')
        self.assertIn(response.status_code, (400, 403, 404))
        self.assertFalse(Service.objects.filter(Nome='Invasor').exists())

    def test_barber_can_create_service_in_own_business(self):
        self.sign_in(self.barber)
        response = self.client.post('/service/', {
            'Barbearia': self.shop.pk,
            'Nome': 'Barba', 'Descricao': 'Aparar barba', 'Preco': '25.00',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Service.objects.filter(Barbearia=self.shop, Nome='Barba').exists())

    def test_barber_can_edit_own_business_service(self):
        self.sign_in(self.barber)
        response = self.client.patch(f'/service/{self.service.pk}/', {
            'Nome': 'Corte completo', 'Preco': '45.00',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.service.refresh_from_db()
        self.assertEqual(self.service.Nome, 'Corte completo')
        self.assertEqual(str(self.service.Preco), '45.00')

    def test_barber_cannot_move_service_to_another_business(self):
        self.sign_in(self.barber)
        response = self.client.patch(f'/service/{self.service.pk}/', {
            'Barbearia': self.other_shop.pk,
        }, format='json')
        self.assertIn(response.status_code, (400, 403, 404))
        self.service.refresh_from_db()
        self.assertEqual(self.service.Barbearia_id, self.shop.pk)


class AvailabilityTests(RoleAPITestCase):
    def available(self, shop=None, **params):
        return self.client.get('/scheduling/available_times/', {
            'date': self.date.isoformat(),
            'barbearia': (shop or self.shop).pk,
            **params,
        })

    def test_public_availability_is_scoped_to_selected_barber(self):
        self.make_booking()
        response = self.available()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('10:00', response.data['available_times'])
        response = self.available(shop=self.other_shop)
        self.assertEqual(response.status_code, 200)
        self.assertIn('10:00', response.data['available_times'])

    def test_availability_requires_a_business_or_barber(self):
        response = self.client.get('/scheduling/available_times/', {'date': self.date.isoformat()})
        self.assertEqual(response.status_code, 400)

    def test_availability_rejects_invalid_business_or_mismatched_barber(self):
        for params in (
            {'barbearia': 'invalid'},
            {'barbearia': 999999},
            {'barbeiro': self.other_barber.pk},
        ):
            with self.subTest(params=params):
                response = self.available(**params)
                self.assertIn(response.status_code, (400, 404))

    def test_availability_respects_business_hours(self):
        self.shop.horario_abertura = '10:00'
        self.shop.horario_fechamento = '16:00'
        self.shop.save()
        response = self.available()
        self.assertEqual(response.status_code, 200)
        slots = response.data['available_times']
        self.assertIn('10:00', slots)
        self.assertIn('15:40', slots)
        self.assertNotIn('08:00', slots)
        self.assertNotIn('16:00', slots)
        self.assertNotIn('16:20', slots)

    def test_booking_respects_business_hours(self):
        self.shop.horario_abertura = '10:00'
        self.shop.horario_fechamento = '16:00'
        self.shop.save()
        self.sign_in(self.customer)
        for slot in ('08:00', '16:20'):
            with self.subTest(slot=slot):
                response = self.client.post('/scheduling/', self.booking_payload(time=slot), format='json')
                self.assertEqual(response.status_code, 400)
        self.assertFalse(Scheduling.objects.exists())

    def test_past_dates_have_no_available_times(self):
        response = self.available(date='2001-01-01')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['available_times'], [])

    def test_elapsed_times_are_not_offered_for_today(self):
        now = timezone.make_aware(datetime.combine(self.date, time(10, 10)))
        with patch('django.utils.timezone.localtime', return_value=now):
            response = self.available()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('10:00', response.data['available_times'])
        self.assertIn('10:20', response.data['available_times'])

    def test_same_barber_cannot_serve_two_of_own_shops_at_same_time(self):
        self.make_booking()
        second_shop = self.make_shop(self.barber, 'Outra unidade do mesmo barbeiro')
        second_service = self.make_service(second_shop)
        self.sign_in(self.other_customer)
        response = self.client.post('/scheduling/', self.booking_payload(service=second_service), format='json')
        self.assertIn(response.status_code, (400, 409))
        response = self.available(shop=second_shop)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('10:00', response.data['available_times'])

    def test_opening_between_slots_rounds_up_to_next_twenty_minutes(self):
        self.shop.horario_abertura = '09:10'
        self.shop.horario_fechamento = '10:00'
        self.shop.save()
        response = self.available()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['available_times'], ['09:20', '09:40'])

    def test_barber_availability_unites_own_shop_hours_without_duplicates(self):
        self.shop.horario_abertura = '08:00'
        self.shop.horario_fechamento = '09:00'
        self.shop.save()
        second_shop = self.make_shop(self.barber, 'Unidade à tarde')
        second_shop.horario_abertura = '14:00'
        second_shop.horario_fechamento = '15:00'
        second_shop.save()
        response = self.client.get('/scheduling/available_times/', {
            'date': self.date.isoformat(), 'barbeiro': self.barber.pk,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['available_times'], ['08:00', '08:20', '08:40', '14:00', '14:20', '14:40'])

    def test_service_filter_remains_compatible_with_business_filter(self):
        response = self.client.get('/scheduling/available_times/', {
            'date': self.date.isoformat(), 'servico': self.service.pk,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['barbeiro'], self.barber.pk)
        self.assertEqual(response.data['available_times'], self.available().data['available_times'])

    def test_barber_cannot_create_client_bookings(self):
        self.sign_in(self.barber)
        response = self.client.post('/scheduling/', self.booking_payload(), format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Scheduling.objects.exists())

    def test_booking_rejects_barber_mismatching_selected_service(self):
        self.sign_in(self.customer)
        response = self.client.post('/scheduling/', {
            **self.booking_payload(), 'barbeiro': self.other_barber.pk,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Scheduling.objects.exists())
