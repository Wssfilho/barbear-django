import json
from unittest.mock import patch

from django.db import OperationalError
from django.test import SimpleTestCase
from django.urls import resolve


class DeploymentTests(SimpleTestCase):
    @patch('barber.health.connection')
    def test_health_checks_database_without_exposing_details(self, database):
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
        database.cursor.return_value.__enter__.return_value.execute.assert_called_once_with('SELECT 1')
        self.assertIn('no-store', response.headers['Cache-Control'])

    @patch('barber.health.connection')
    def test_unavailable_database_returns_503_without_connection_details(self, database):
        database.cursor.side_effect = OperationalError('private database credentials')
        with self.assertLogs('barber.health', level='ERROR'):
            response = self.client.get('/health/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(json.loads(response.content), {'status': 'unavailable'})
        self.assertNotContains(response, 'private', status_code=503)

    def test_frontend_prefix_resolves_to_existing_api_views(self):
        for route in (
            'api/token/cliente/', 'api/token/barbeiro/', 'api/token/refresh/',
            'usuario/me/', 'barbshop/', 'service/', 'scheduling/',
        ):
            with self.subTest(route=route):
                original = resolve('/' + route)
                prefixed = resolve('/django/' + route)
                self.assertEqual(original.func.cls, prefixed.func.cls)
                self.assertEqual(getattr(original.func, 'actions', None), getattr(prefixed.func, 'actions', None))
