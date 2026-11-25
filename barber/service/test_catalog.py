from service.models import Service
from test_support import RoleAPITestCase


class ServiceCatalogTests(RoleAPITestCase):
    def test_anonymous_can_list_all_services_with_their_shops(self):
        response = self.client.get('/service/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 200)
        services = self.response_items(response, 'services')
        self.assertEqual({item['id'] for item in services}, {self.service.pk, self.other_service.pk})
        expected_shops = {
            self.service.pk: {'id': self.shop.pk, 'Nome': self.shop.Nome},
            self.other_service.pk: {'id': self.other_shop.pk, 'Nome': self.other_shop.Nome},
        }
        for item in services:
            self.assertEqual(item['Barbearia'], expected_shops[item['id']])
            self.assertEqual(item['Nome'], 'Corte')
            self.assertEqual(item['Descricao'], 'Corte de cabelo')
            self.assertEqual(item['Preco'], '35.00')

    def test_customer_can_list_services_from_all_shops(self):
        self.sign_in(self.customer)

        response = self.client.get('/service/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item['id'] for item in self.response_items(response, 'services')},
            {self.service.pk, self.other_service.pk},
        )

    def test_shop_filter_returns_only_matching_services_and_shop(self):
        for shop, service in ((self.shop, self.service), (self.other_shop, self.other_service)):
            with self.subTest(shop=shop.pk):
                response = self.client.get('/service/', {'id': shop.pk})

                self.assertEqual(response.status_code, 200)
                items = self.response_items(response, 'services')
                self.assertEqual([item['id'] for item in items], [service.pk])
                self.assertEqual(items[0]['Barbearia'], {'id': shop.pk, 'Nome': shop.Nome})

    def test_shop_without_services_returns_empty_list(self):
        shop = self.make_shop(self.barber, 'Loja sem serviços')

        response = self.client.get('/service/', {'id': shop.pk})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'status': 200, 'services': []})

    def test_nonexistent_shop_returns_empty_list(self):
        response = self.client.get('/service/', {'id': 999999})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'status': 200, 'services': []})

    def test_empty_catalog_returns_empty_list(self):
        Service.objects.all().delete()

        response = self.client.get('/service/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'status': 200, 'services': []})

    def test_present_invalid_shop_id_returns_bad_request(self):
        for value in ('', 'abc', '1x', '-1', '1.5', ' ', '²'):
            with self.subTest(value=value):
                response = self.client.get('/service/', {'id': value})

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data['status'], 400)

    def test_catalog_order_is_name_then_id(self):
        last = Service.objects.create(Barbearia=self.shop, Nome='Z Corte', Descricao='', Preco='40.00')
        first = Service.objects.create(Barbearia=self.other_shop, Nome='A Barba', Descricao='', Preco='25.00')

        response = self.client.get('/service/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item['id'] for item in self.response_items(response, 'services')],
            [first.pk, self.service.pk, self.other_service.pk, last.pk],
        )

    def test_public_catalog_fetches_shop_associations_in_one_query(self):
        with self.assertNumQueries(1):
            response = self.client.get('/service/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.response_items(response, 'services')), 2)
