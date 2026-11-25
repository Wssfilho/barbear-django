# As permissões por perfil ficam no app Usuario; este módulo mantém o import
# histórico `from barbshop.permissions import IsBarbeiro`.
from Usuario.permissions import IsBarbeiro, IsCliente, TemPerfil, get_perfil

__all__ = ['IsBarbeiro', 'IsCliente', 'TemPerfil', 'get_perfil']
