from django.core.exceptions import ObjectDoesNotExist
from rest_framework import permissions


def get_perfil(user):
    """Retorna o perfil Usuario do User autenticado, ou None."""
    if not user or not user.is_authenticated:
        return None
    try:
        return user.usuario
    except ObjectDoesNotExist:
        return None


class TemPerfil(permissions.BasePermission):
    """Usuário autenticado com perfil de cliente ou barbeiro."""
    message = 'Esta conta não possui perfil de cliente ou barbeiro.'

    def has_permission(self, request, view):
        perfil = get_perfil(request.user)
        return perfil is not None and perfil.perfil is not None


class IsBarbeiro(permissions.BasePermission):
    """
    Permissão customizada para permitir apenas barbeiros.
    """
    message = 'Apenas barbeiros podem acessar esta rota.'

    def has_permission(self, request, view):
        perfil = get_perfil(request.user)
        return perfil is not None and perfil.is_barbeiro


class IsCliente(permissions.BasePermission):
    """Permite apenas clientes."""
    message = 'Apenas clientes podem acessar esta rota.'

    def has_permission(self, request, view):
        perfil = get_perfil(request.user)
        return perfil is not None and perfil.is_cliente
