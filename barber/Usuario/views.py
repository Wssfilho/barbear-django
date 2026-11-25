from datetime import datetime

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication

from barbshop.models import BarberShop
from scheduling.models import Scheduling
from .models import Usuario
from .permissions import IsBarbeiro, TemPerfil, get_perfil
from .serializer import (
    ClienteCadastroSerializer, PerfilUpdateSerializer, UsuarioMeSerializer, UsuarioSerializer,
    first_error,
)


def erro(message, http_status, errors=None):
    body = {'status': http_status, 'msg': message}
    if errors:
        body['errors'] = errors
    return Response(body, status=http_status)


class UsuarioModelViewSet(GenericViewSet):
    """
    - POST /usuario/            cadastro público (sempre cliente)
    - GET  /usuario/            barbeiro: clientes com agendamentos com ele
    - GET  /usuario/{id}/       próprio perfil ou, para barbeiro, um de seus clientes
    - GET/PATCH /usuario/me/    perfil autenticado
    - GET  /usuario/barbeiros/  barbeiros disponíveis (público)
    Não há atualização ou exclusão de perfis de terceiros pela API.
    """
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated, TemPerfil)
    serializer_class = UsuarioSerializer
    queryset = Usuario.objects.select_related('Vinculado')

    def get_permissions(self):
        if self.action in ('create', 'barbeiros'):
            return [AllowAny()]
        if self.action == 'list':
            return [IsAuthenticated(), IsBarbeiro()]
        return super().get_permissions()

    def clientes_do_barbeiro(self, barbeiro):
        return Usuario.objects.select_related('Vinculado').filter(
            TipoUsuario=Usuario.CLIENTE,
            scheduling__barbeiro=barbeiro,
        ).distinct()

    # Listar os clientes do barbeiro autenticado
    def list(self, request):
        barbeiro = get_perfil(request.user)
        clientes = self.clientes_do_barbeiro(barbeiro).order_by('Vinculado__first_name', 'id')

        agora = timezone.localtime().replace(tzinfo=None)
        agenda = Scheduling.objects.filter(barbeiro=barbeiro).order_by(
            'data_agendamento', 'horario_agendamento')
        totais, proximos = {}, {}
        for item in agenda:
            totais[item.cliente_id] = totais.get(item.cliente_id, 0) + 1
            quando = datetime.combine(item.data_agendamento, item.horario_agendamento)
            if item.cliente_id not in proximos and quando >= agora:
                proximos[item.cliente_id] = item

        data = []
        for cliente in clientes:
            row = UsuarioSerializer(cliente).data
            row['total_agendamentos'] = totais.get(cliente.id, 0)
            proximo = proximos.get(cliente.id)
            row['proximo_agendamento'] = proximo and {
                'id': proximo.id,
                'data_agendamento': proximo.data_agendamento.isoformat(),
                'horario_agendamento': proximo.horario_agendamento.strftime('%H:%M:%S'),
            }
            data.append(row)
        return Response({'status': 200, 'Usuario': data})

    def retrieve(self, request, pk=None):
        perfil = get_perfil(request.user)
        if str(perfil.id) == str(pk):
            return Response({'status': 200, 'Usuario': UsuarioMeSerializer(perfil).data})
        if perfil.is_barbeiro:
            cliente = self.clientes_do_barbeiro(perfil).filter(pk=pk).first()
            if cliente:
                return Response({'status': 200, 'Usuario': UsuarioSerializer(cliente).data})
        return erro('Usuário não encontrado.', status.HTTP_404_NOT_FOUND)

    # Retornar ou atualizar os dados do usuário autenticado
    @action(methods=['get', 'patch'], detail=False)
    def me(self, request):
        usuario = get_perfil(request.user)
        if request.method == 'PATCH':
            serializer = PerfilUpdateSerializer(data=request.data, partial=True)
            if not serializer.is_valid():
                return erro(first_error(serializer.errors), status.HTTP_400_BAD_REQUEST, serializer.errors)
            usuario = serializer.update(usuario, serializer.validated_data)
        return Response({'status': 200, 'Usuario': UsuarioMeSerializer(usuario).data})

    # Barbeiros com barbearia cadastrada, disponíveis para agendamento
    @action(methods=['get'], detail=False)
    def barbeiros(self, request):
        barbeiros = Usuario.objects.select_related('Vinculado').filter(
            TipoUsuario=Usuario.BARBEIRO, barbershop__isnull=False,
        ).distinct().prefetch_related(
            Prefetch('barbershop_set', queryset=BarberShop.objects.order_by('Nome')),
        ).order_by('Vinculado__first_name', 'id')
        data = [{
            'id': barbeiro.id,
            'nome': barbeiro.Vinculado.first_name or barbeiro.Vinculado.username,
            'barbearias': [{
                'id': shop.id, 'Nome': shop.Nome, 'Endereco': shop.Endereco,
                'horario_abertura': shop.horario_abertura, 'horario_fechamento': shop.horario_fechamento,
            } for shop in barbeiro.barbershop_set.all()],
        } for barbeiro in barbeiros]
        return Response({'status': 200, 'barbeiros': data})

    # Cadastro público: sempre cria um cliente
    def create(self, request):
        tipo = request.data.get('tipo_usuario', Usuario.CLIENTE)
        if str(tipo) != str(Usuario.CLIENTE):
            return erro('O cadastro público permite apenas contas de cliente.', status.HTTP_403_FORBIDDEN)
        serializer = ClienteCadastroSerializer(data=request.data)
        if not serializer.is_valid():
            return erro(first_error(serializer.errors), status.HTTP_400_BAD_REQUEST, serializer.errors)
        usuario = serializer.save()
        return Response({
            'status': 201, 'msg': 'User registered successfully',
            'Usuario': UsuarioMeSerializer(usuario).data,
        }, status=status.HTTP_201_CREATED)
