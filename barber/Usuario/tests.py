from datetime import date, time, timedelta

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from scheduling.models import Scheduling
from .models import Usuario
from .testing import SENHA, cliente_api, criar_barbearia, criar_servico, criar_usuario


class LoginPorPerfilTests(TestCase):
    def setUp(self):
        self.cliente = criar_usuario('cliente')
        self.barbeiro = criar_usuario('barbeiro', Usuario.BARBEIRO)
        self.api = APIClient()

    def login(self, rota, username):
        return self.api.post(rota, {'username': username, 'password': SENHA}, format='json')

    def test_login_generico_informa_perfil(self):
        for username, perfil in (('cliente', 'cliente'), ('barbeiro', 'barbeiro')):
            response = self.login('/api/token/', username)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['perfil'], perfil)
            self.assertEqual(AccessToken(response.data['access'])['perfil'], perfil)

    def test_login_de_cliente_recusa_barbeiro(self):
        self.assertEqual(self.login('/api/token/cliente/', 'cliente').status_code, 200)
        response = self.login('/api/token/cliente/', 'barbeiro')
        self.assertEqual(response.status_code, 403)

    def test_login_de_barbeiro_recusa_cliente(self):
        self.assertEqual(self.login('/api/token/barbeiro/', 'barbeiro').status_code, 200)
        response = self.login('/api/token/barbeiro/', 'cliente')
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('access', response.data)

    def test_conta_sem_perfil_nao_recebe_token(self):
        User.objects.create_superuser('admin', 'admin@example.com', SENHA)
        self.assertEqual(self.login('/api/token/', 'admin').status_code, 403)

    def test_senha_errada(self):
        response = self.api.post('/api/token/barbeiro/', {'username': 'barbeiro', 'password': 'x'}, format='json')
        self.assertEqual(response.status_code, 401)


class CadastroPublicoTests(TestCase):
    dados = {
        'username': 'novo', 'password': 'Senha-forte-123', 'first_name': 'Novo',
        'email': 'novo@example.com', 'telefone': '71999999999', 'cpf': '12345678901',
    }

    def test_cadastro_cria_cliente(self):
        response = APIClient().post('/usuario/', self.dados, format='json')
        self.assertEqual(response.status_code, 201)
        usuario = Usuario.objects.get(Vinculado__username='novo')
        self.assertTrue(usuario.is_cliente)
        self.assertTrue(usuario.Vinculado.check_password('Senha-forte-123'))

    def test_cadastro_nao_concede_barbeiro(self):
        for tipo in (2, '2', 'barbeiro'):
            response = APIClient().post('/usuario/', {**self.dados, 'tipo_usuario': tipo}, format='json')
            self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username='novo').exists())

    def test_cadastro_ignora_campos_de_privilegio(self):
        response = APIClient().post('/usuario/', {**self.dados, 'TipoUsuario': 2, 'is_staff': True,
                                                  'is_superuser': True}, format='json')
        self.assertEqual(response.status_code, 201)
        usuario = Usuario.objects.get(Vinculado__username='novo')
        self.assertTrue(usuario.is_cliente)
        self.assertFalse(usuario.Vinculado.is_staff or usuario.Vinculado.is_superuser)

    def test_cadastro_valida_duplicidade_e_campos(self):
        self.assertEqual(APIClient().post('/usuario/', self.dados, format='json').status_code, 201)
        response = APIClient().post('/usuario/', self.dados, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.filter(username='novo').count(), 1)
        response = APIClient().post('/usuario/', {**self.dados, 'username': 'outro', 'cpf': '123'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='outro').exists())

    def test_cadastro_exige_senha_valida(self):
        response = APIClient().post('/usuario/', {**self.dados, 'password': '123'}, format='json')
        self.assertEqual(response.status_code, 400)


class PerfilTests(TestCase):
    def setUp(self):
        self.cliente = criar_usuario('cliente')
        self.outro = criar_usuario('outro')
        self.barbeiro = criar_usuario('barbeiro', Usuario.BARBEIRO)

    def test_me_exige_autenticacao(self):
        self.assertEqual(APIClient().get('/usuario/me/').status_code, 401)

    def test_me_retorna_perfil(self):
        response = cliente_api(self.barbeiro).get('/usuario/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['Usuario']['perfil'], 'barbeiro')
        self.assertEqual(response.data['Usuario']['tipo_usuario'], 2)

    def test_patch_me_nao_altera_tipo(self):
        api = cliente_api(self.cliente)
        response = api.patch('/usuario/me/', {'first_name': 'Maria', 'tipo_usuario': 2, 'TipoUsuario': 2}, format='json')
        self.assertEqual(response.status_code, 200)
        self.cliente.refresh_from_db()
        self.cliente.Vinculado.refresh_from_db()
        self.assertEqual(self.cliente.Vinculado.first_name, 'Maria')
        self.assertTrue(self.cliente.is_cliente)

    def test_escrita_em_perfis_por_id_nao_existe(self):
        api = cliente_api(self.cliente)
        for method in ('put', 'patch', 'delete'):
            response = getattr(api, method)(f'/usuario/{self.outro.id}/', {'first_name': 'X'}, format='json')
            self.assertEqual(response.status_code, 405)
        self.assertTrue(Usuario.objects.filter(pk=self.outro.pk).exists())

    def test_cliente_ve_apenas_o_proprio_perfil(self):
        api = cliente_api(self.cliente)
        self.assertEqual(api.get(f'/usuario/{self.cliente.id}/').status_code, 200)
        self.assertEqual(api.get(f'/usuario/{self.outro.id}/').status_code, 404)
        self.assertEqual(api.get('/usuario/').status_code, 403)


class ClientesDoBarbeiroTests(TestCase):
    def setUp(self):
        self.barbeiro = criar_usuario('barbeiro', Usuario.BARBEIRO)
        self.rival = criar_usuario('rival', Usuario.BARBEIRO)
        self.meu_cliente = criar_usuario('meu')
        self.cliente_rival = criar_usuario('dele')
        self.servico = criar_servico(criar_barbearia(self.barbeiro))
        servico_rival = criar_servico(criar_barbearia(self.rival, 'Rival'))
        amanha = date.today() + timedelta(days=1)
        Scheduling.objects.create(cliente=self.meu_cliente, servico=self.servico,
                                  data_agendamento=amanha, horario_agendamento=time(9))
        Scheduling.objects.create(cliente=self.cliente_rival, servico=servico_rival,
                                  data_agendamento=amanha, horario_agendamento=time(9))

    def test_barbeiro_lista_apenas_seus_clientes(self):
        response = cliente_api(self.barbeiro).get('/usuario/')
        self.assertEqual(response.status_code, 200)
        ids = [item['id'] for item in response.data['Usuario']]
        self.assertEqual(ids, [self.meu_cliente.id])
        self.assertEqual(response.data['Usuario'][0]['total_agendamentos'], 1)
        self.assertIsNotNone(response.data['Usuario'][0]['proximo_agendamento'])
        self.assertNotIn('cpf', response.data['Usuario'][0])

    def test_barbeiro_nao_ve_cliente_de_outro(self):
        api = cliente_api(self.barbeiro)
        self.assertEqual(api.get(f'/usuario/{self.meu_cliente.id}/').status_code, 200)
        self.assertEqual(api.get(f'/usuario/{self.cliente_rival.id}/').status_code, 404)

    def test_barbeiros_disponiveis_publico(self):
        criar_usuario('sem_barbearia', Usuario.BARBEIRO)
        response = APIClient().get('/usuario/barbeiros/')
        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data['barbeiros']}
        self.assertEqual(ids, {self.barbeiro.id, self.rival.id})


class CriarBarbeiroCommandTests(TestCase):
    def test_cria_e_promove(self):
        call_command('criar_barbeiro', 'joao', password=SENHA, nome='João', stdout=open('/dev/null', 'w'))
        self.assertTrue(Usuario.objects.get(Vinculado__username='joao').is_barbeiro)
        cliente = criar_usuario('ana')
        call_command('criar_barbeiro', 'ana', stdout=open('/dev/null', 'w'))
        cliente.refresh_from_db()
        self.assertTrue(cliente.is_barbeiro)
