import json
from io import BytesIO, BufferedReader, RawIOBase
from http.client import HTTPResponse
import errno
from datetime import timedelta
from django.utils import timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from django.test import SimpleTestCase, override_settings
from test_support import RoleAPITestCase
from . import provider
from .finance import compare
from .models import AssistantUsage, Plan

HAIRCUTS = [{'name': 'Corte clássico', 'reason': 'Combina com a preferência discreta.', 'maintenance': 'Manutenção simples.'}]
CONFIG = dict(AI_PROVIDER='gemini', AI_MODEL='', GEMINI_API_KEY='test-key-not-real-1234567890', AI_REQUESTS_PER_HOUR=2, AI_COOLDOWN_SECONDS=30)


@override_settings(**CONFIG)
class AssistantAPITests(RoleAPITestCase):
    def payload(self):
        return dict(barbershop_id=self.shop.pk, service_id=self.service.pk,
                    hair_type='wavy', hair_length='short', style='classic', maintenance='low',
                    monthly_visits=4, monthly_budget='150.00', preferences='Prefiro discreto')

    def plan(self, **kwargs):
        defaults = dict(barbershop=self.shop, service=self.service, name='Mensal', monthly_price=Decimal('90'), included_visits=3)
        defaults.update(kwargs)
        return Plan.objects.create(**defaults)

    def test_decimal_extras_tie_and_budget(self):
        plan = self.plan()
        self.service.refresh_from_db()
        comparison = compare(self.service, [plan], 4, Decimal('120'))
        self.assertEqual(comparison['plans'][0]['estimated_total'], '125.00')
        self.assertEqual(comparison['plans'][0]['savings'], '15.00')
        self.assertFalse(comparison['recommendation']['within_budget'])
        self.assertEqual(comparison['recommendation']['kind'], 'plan')
        plan.monthly_price = Decimal('105')
        self.assertEqual(compare(self.service, [plan], 4, None)['recommendation']['kind'], 'pay_as_you_go')

    def test_plan_public_active_filter_and_owner_permissions(self):
        plan = self.plan()
        self.plan(active=False, name='Oculto')
        r = self.client.get(f'/django/plans/?barbearia={self.shop.pk}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['plans']), 1)
        self.assertEqual(self.client.patch(f'/plans/{plan.pk}/', {'name': 'x'}).status_code, 401)
        self.sign_in(self.other_barber)
        self.assertEqual(self.client.patch(f'/plans/{plan.pk}/', {'name': 'x'}).status_code, 403)
        self.sign_in(self.customer)
        self.assertEqual(self.client.get('/plans/mine/').status_code, 403)
        self.sign_in(self.barber)
        self.assertEqual(len(self.client.get('/plans/mine/').data['plans']), 2)
        self.assertEqual(self.client.patch(f'/plans/{plan.pk}/', {'service_id': self.other_service.pk}).status_code, 403)

    def test_cross_shop_validation_and_create_delete(self):
        self.sign_in(self.barber)
        own_shop = self.make_shop(self.barber, 'Outra minha')
        payload = dict(barbershop_id=self.shop.pk, service_id=self.service.pk, name='Plano', monthly_price='99.90', included_visits=4, active=True)
        r = self.client.post('/plans/', payload, format='json')
        self.assertEqual(r.status_code, 201)
        pk = r.data['plan']['id']
        r = self.client.patch(f'/plans/{pk}/', {'barbershop_id': own_shop.pk}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.delete(f'/plans/{pk}/').status_code, 204)
        payload['monthly_price'] = '-1.00'
        self.assertEqual(self.client.post('/plans/', payload, format='json').status_code, 400)

    @patch('assistant.provider.recommend_haircuts', return_value=HAIRCUTS)
    def test_recommend_finance_duplicate_and_authorization(self, mocked):
        self.plan()
        payload = self.payload()
        self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 401)
        self.sign_in(self.barber)
        self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 403)
        self.sign_in(self.customer)
        r = self.client.post('/django/assistant/recommend/', payload, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['comparison']['recommendation']['estimated_total'], '125.00')
        self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 429)
        self.assertEqual(mocked.call_count, 1)

    @patch('assistant.provider.recommend_haircuts', return_value=HAIRCUTS)
    def test_invalid_input_no_spend_and_empty_plans(self, mocked):
        self.sign_in(self.customer)
        payload = self.payload()
        for changes in ({'service_id': self.other_service.pk}, {'preferences': 'a'*501}, {'monthly_visits': 9}, {'endpoint': 'https://bad.test'}):
            self.assertEqual(self.client.post('/assistant/recommend/', {**payload, **changes}, format='json').status_code, 400)
        self.assertFalse(AssistantUsage.objects.exists())
        r = self.client.post('/assistant/recommend/', payload, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['comparison']['plans'], [])
        self.assertEqual(r.data['comparison']['recommendation']['kind'], 'pay_as_you_go')

    @patch('assistant.provider.recommend_haircuts', return_value=HAIRCUTS)
    def test_persistent_hourly_quota_and_cooldown(self, mocked):
        self.sign_in(self.customer)
        payload = self.payload()
        self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 200)
        payload['style'] = 'modern'
        self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 429)
        base = timezone.now()
        with patch('assistant.quota.timezone.now', return_value=base+timedelta(seconds=31)):
            self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 200)
        payload['style'] = 'bold'
        with patch('assistant.quota.timezone.now', return_value=base+timedelta(seconds=62)):
            self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 429)
        with patch('assistant.quota.timezone.now', return_value=base+timedelta(hours=1, seconds=1)):
            self.assertEqual(self.client.post('/assistant/recommend/', payload, format='json').status_code, 200)
        self.assertEqual(mocked.call_count, 3)

    @override_settings(GEMINI_API_KEY='')
    def test_missing_configuration(self):
        self.assertEqual(self.client.get('/assistant/status/').data, {'available': False})
        self.sign_in(self.customer)
        self.assertEqual(self.client.post('/assistant/recommend/', self.payload(), format='json').status_code, 503)
        self.assertFalse(AssistantUsage.objects.exists())

    @patch('assistant.provider.recommend_haircuts', side_effect=provider.ProviderTimeout())
    def test_timeout_friendly(self, mocked):
        self.sign_in(self.customer)
        self.assertEqual(self.client.post('/assistant/recommend/', self.payload(), format='json').status_code, 504)


class ClosingSocket:
    """Socket double whose actual HTTPResponse makefile owns its lifecycle."""
    def __init__(self, wire):
        self.wire = BytesIO(wire)
        self.closed = False
        self.timeouts = []

    def makefile(self, mode):
        return BufferedReader(ClosingSocketStream(self))

    def settimeout(self, value):
        if self.closed:
            raise OSError(errno.EBADF, 'Bad file descriptor')
        self.timeouts.append(value)


class ClosingSocketStream(RawIOBase):
    def __init__(self, sock):
        super().__init__()
        self._sock = sock

    def readable(self):
        return True

    def readinto(self, buffer):
        return self._sock.wire.readinto(buffer)

    def close(self):
        self._sock.closed = True
        super().close()


@override_settings(**CONFIG)
class ProviderTests(SimpleTestCase):
    def call(self, result):
        opener = MagicMock()
        response = opener.open.return_value.__enter__.return_value
        response.read1.side_effect = BytesIO(json.dumps(result).encode()).read1
        data = dict(hair_type='curly', hair_length='short', style='classic', maintenance='low',
                    preferences='Email a@example.com telefone 71999999999', monthly_budget='150.00', name='PRIVATE')
        with patch('assistant.provider.request.build_opener', return_value=opener):
            value = provider.recommend_haircuts(data)
        req = opener.open.call_args.args[0]
        return value, req, opener

    def gemini_result(self, data=None):
        return {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(data or {'haircuts': HAIRCUTS})}]}}]}

    def test_gemini_schema_bounds_privacy(self):
        value, req, opener = self.call(self.gemini_result())
        self.assertEqual(value, HAIRCUTS)
        self.assertIn('gemini-3.8-flash:generateContent', req.full_url)
        sent = req.data.decode()
        self.assertNotIn('PRIVATE', sent)
        self.assertNotIn('a@example.com', sent)
        self.assertNotIn('71999999999', sent)
        self.assertNotIn('150.00', sent)
        self.assertEqual(opener.open.call_args.kwargs['timeout'], 25)
        body = json.loads(sent)
        self.assertEqual(body['generationConfig']['responseFormat']['text']['schema'], provider.SCHEMA)
        self.assertEqual(body['generationConfig']['thinkingConfig'], {'thinkingLevel': 'LOW'})
        self.assertEqual(body['generationConfig']['maxOutputTokens'], 1200)
        self.assertEqual(provider.SCHEMA['properties']['haircuts']['maxItems'], 3)

    @override_settings(AI_PROVIDER='openai', OPENAI_API_KEY='sk-test-not-real-1234567890')
    def test_openai_structured_output(self):
        value, req, _ = self.call({'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({'haircuts': HAIRCUTS})}}]})
        self.assertEqual(value, HAIRCUTS)
        body = json.loads(req.data)
        self.assertTrue(body['response_format']['json_schema']['strict'])
        self.assertEqual(body['model'], 'gpt-5.4-mini')
        self.assertEqual(body['reasoning_effort'], 'none')
        self.assertEqual(body['max_completion_tokens'], 1600)
        self.assertNotIn('temperature', body)

    @override_settings(GEMINI_API_KEY='fake.opaque.key+with/punctuation=1234567890')
    def test_opaque_key_with_dot_is_preserved(self):
        _, _, key = provider.configuration()
        self.assertEqual(key, 'fake.opaque.key+with/punctuation=1234567890')
        value, req, _ = self.call(self.gemini_result())
        self.assertEqual(value, HAIRCUTS)
        self.assertEqual(req.get_header('X-goog-api-key'), key)

    def test_unsafe_or_unbounded_keys_are_refused(self):
        for key in ('', 'fake-key-1234567890\r\nInjected: header',
                    'fake-key-123456789012345\r\n',
                    ' fake-key-123456789012345',
                    'fake-key-12345 6789012345',
                    'fake-key-123456789012345\t',
                    'fake-key-123456789012345\x00',
                    'fake-key-123456789012345\x7f',
                    'fake-key-123456789012345á',
                    'k'*4097):
            with self.subTest(key_kind=repr(key[-10:])):
                with override_settings(GEMINI_API_KEY=key):
                    self.assertFalse(provider.available())
                    with self.assertRaises(provider.ProviderUnavailable):
                        provider.configuration()

    def test_rejects_oversize_invalid_and_financial_output(self):
        for data in ({'haircuts': HAIRCUTS*4}, {'haircuts': [{'name': 'Plano R$10', 'reason': 'bom', 'maintenance': 'baixa'}]}, {'haircuts': HAIRCUTS, 'summary': 'injected'}):
            with self.assertRaises(provider.ProviderError):
                self.call(self.gemini_result(data))

    def test_response_deadline_uses_remaining_socket_budget(self):
        response = MagicMock()
        response.read1.side_effect = [b'{}', b'']
        with patch('assistant.provider.time.monotonic', side_effect=[21, 22, 23, 24]):
            self.assertEqual(provider.read_response(response, 25), b'{}')
        self.assertEqual([call.args[0] for call in response.fp.raw._sock.settimeout.call_args_list], [4, 2])

    def test_response_deadline_refuses_expired_or_slow_read(self):
        response = MagicMock()
        with patch('assistant.provider.time.monotonic', return_value=25):
            with self.assertRaises(provider.ProviderTimeout):
                provider.read_response(response, 25)
        response.read1.assert_not_called()
        response.read1.return_value = b'{}'
        with patch('assistant.provider.time.monotonic', side_effect=[24, 25]):
            with self.assertRaises(provider.ProviderTimeout):
                provider.read_response(response, 25)

    def test_response_size_remains_bounded(self):
        response = MagicMock()
        response.read1.side_effect = BytesIO(b'x'*(provider.MAX_RESPONSE_BYTES+100)).read1
        with patch('assistant.provider.time.monotonic', return_value=1):
            raw = provider.read_response(response, 25)
        self.assertEqual(len(raw), provider.MAX_RESPONSE_BYTES+1)

    def http_response(self, body, chunked=False):
        if chunked:
            encoded = b''.join(format(len(part), 'x').encode()+b'\r\n'+part+b'\r\n'
                               for part in (body[:7], body[7:]) if part)
            wire = b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n'+encoded+b'0\r\n\r\n'
        else:
            wire = b'HTTP/1.1 200 OK\r\nContent-Length: '+str(len(body)).encode()+b'\r\n\r\n'+body
        sock = ClosingSocket(wire)
        response = HTTPResponse(sock)
        response.begin()
        self.addCleanup(response.close)
        return response, sock

    def test_real_http_response_closes_socket_at_end(self):
        for chunked in (False, True):
            with self.subTest(chunked=chunked):
                response, sock = self.http_response(b'{"healthy":true}', chunked)
                with patch('assistant.provider.time.monotonic', return_value=1):
                    self.assertEqual(provider.read_response(response, 25), b'{"healthy":true}')
                self.assertTrue(response.isclosed())
                self.assertTrue(sock.closed)
                self.assertTrue(sock.timeouts)
                with self.assertRaises(OSError):
                    sock.settimeout(1)

    def test_real_http_response_empty_content_length(self):
        response, sock = self.http_response(b'')
        with patch('assistant.provider.time.monotonic', return_value=1):
            self.assertEqual(provider.read_response(response, 25), b'')
        self.assertEqual(sock.timeouts, [])

    def test_real_http_response_oversize_is_bounded(self):
        for chunked in (False, True):
            with self.subTest(chunked=chunked):
                response, _ = self.http_response(b'x'*(provider.MAX_RESPONSE_BYTES+100), chunked)
                with patch('assistant.provider.time.monotonic', return_value=1):
                    self.assertEqual(len(provider.read_response(response, 25)), provider.MAX_RESPONSE_BYTES+1)

    def test_real_http_response_deadline_after_final_read(self):
        for chunked in (False, True):
            with self.subTest(chunked=chunked):
                response, _ = self.http_response(b'{}', chunked)
                with patch('assistant.provider.time.monotonic', side_effect=[24, 25]):
                    with self.assertRaises(provider.ProviderTimeout):
                        provider.read_response(response, 25)

    def test_suppresses_provider_errors(self):
        with patch('assistant.provider.request.build_opener') as factory:
            factory.return_value.open.side_effect = HTTPError('private', 401, 'secret', {}, None)
            with self.assertRaises(provider.ProviderError) as exc:
                provider.recommend_haircuts(dict(hair_type='curly', hair_length='short', style='classic', maintenance='low'))
            self.assertNotIn('secret', exc.exception.message)

    def test_http_capacity_errors_are_friendly_unavailable(self):
        data = dict(hair_type='curly', hair_length='short', style='classic', maintenance='low')
        for code in (429, 503):
            with self.subTest(code=code), patch('assistant.provider.request.build_opener') as factory:
                factory.return_value.open.side_effect = HTTPError('private', code, 'secret upstream message', {}, BytesIO(b'private raw output'))
                with self.assertRaises(provider.ProviderUnavailable) as caught:
                    provider.recommend_haircuts(data)
                self.assertEqual(caught.exception.status_code, 503)
                self.assertEqual(caught.exception.message, 'O assistente está indisponível no momento.')
                self.assertNotIn('secret', str(caught.exception))

    def test_other_http_errors_remain_bad_gateway(self):
        data = dict(hair_type='curly', hair_length='short', style='classic', maintenance='low')
        for code in (400, 401, 403, 404, 500, 504):
            with self.subTest(code=code), patch('assistant.provider.request.build_opener') as factory:
                factory.return_value.open.side_effect = HTTPError('private', code, 'secret upstream message', {}, None)
                with self.assertRaises(provider.ProviderError) as caught:
                    provider.recommend_haircuts(data)
                self.assertEqual(caught.exception.status_code, 502)
                self.assertNotIn('secret', caught.exception.message)
