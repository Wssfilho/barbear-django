from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import get_perfil


class PerfilTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Emite o par JWT e informa o perfil da conta.

    `perfil_esperado` (definido pela view) restringe o login a um perfil.
    O claim `perfil` no token é apenas informativo: as permissões do
    backend sempre consultam o perfil persistido no banco.
    """
    perfil_esperado = None

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        perfil = get_perfil(user)
        token['perfil'] = perfil.perfil if perfil else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        perfil = get_perfil(self.user)
        if perfil is None or perfil.perfil is None:
            raise PermissionDenied('Esta conta não possui perfil de cliente ou barbeiro.')
        if self.perfil_esperado and perfil.perfil != self.perfil_esperado:
            if self.perfil_esperado == 'barbeiro':
                raise PermissionDenied('Esta conta não é de barbeiro. Use o acesso de cliente.')
            raise PermissionDenied('Esta conta é de barbeiro. Use o acesso do barbeiro.')
        data['perfil'] = perfil.perfil
        data['tipo_usuario'] = perfil.TipoUsuario
        return data


class ClienteTokenObtainPairSerializer(PerfilTokenObtainPairSerializer):
    perfil_esperado = 'cliente'


class BarbeiroTokenObtainPairSerializer(PerfilTokenObtainPairSerializer):
    perfil_esperado = 'barbeiro'


class PerfilTokenObtainPairView(TokenObtainPairView):
    serializer_class = PerfilTokenObtainPairSerializer


class ClienteTokenObtainPairView(TokenObtainPairView):
    serializer_class = ClienteTokenObtainPairSerializer


class BarbeiroTokenObtainPairView(TokenObtainPairView):
    serializer_class = BarbeiroTokenObtainPairSerializer
