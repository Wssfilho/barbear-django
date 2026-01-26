from rest_framework import permissions


class IsBarbeiro(permissions.BasePermission):
    """
    Permissão customizada para permitir apenas barbeiros.
    """
    message = 'Apenas barbeiros podem acessar esta rota.'

    def has_permission(self, request, view):
        # Verifica se o usuário está autenticado
        if not request.user.is_authenticated:
            return False

        # Verifica se tem um Usuario vinculado
        try:
            from Usuario.models import Usuario
            usuario = Usuario.objects.get(Vinculado=request.user)
            return usuario.TipoUsuario == 2
        except Usuario.DoesNotExist:
            return False
