from django.db import models
from django.contrib.auth.models import User

# Create your models here.


class Usuario(models.Model):
    # vai existir dois tipos de usuario: Cliente e Barbeiro, 1 para cliente e 2 para barbeiro
    CLIENTE = 1
    BARBEIRO = 2
    TIPOS = (
        (CLIENTE, 'Cliente'),
        (BARBEIRO, 'Barbeiro'),
    )
    PERFIS = {CLIENTE: 'cliente', BARBEIRO: 'barbeiro'}

    Vinculado = models.OneToOneField(User, on_delete=models.CASCADE)
    Telefone = models.CharField(max_length=11, default=00000000000)
    cpf = models.CharField(max_length=11, default="00000000000")
    TipoUsuario = models.IntegerField(default=CLIENTE, choices=TIPOS)

    @property
    def is_cliente(self):
        return self.TipoUsuario == self.CLIENTE

    @property
    def is_barbeiro(self):
        return self.TipoUsuario == self.BARBEIRO

    @property
    def perfil(self):
        return self.PERFIS.get(self.TipoUsuario)

    def __str__(self):
        return self.Vinculado.first_name or self.Vinculado.username
