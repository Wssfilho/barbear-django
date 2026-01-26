from django.db import models
from django.contrib.auth.models import User

# Create your models here.


class Usuario(models.Model):
    # vai existir dois tipos de usuario: Cliente e Barbeiro, 1 para cliente e 2 para barbeiro
    Vinculado = models.OneToOneField(User, on_delete=models.CASCADE)
    Telefone = models.CharField(max_length=11, default=00000000000)
    cpf = models.CharField(max_length=11, default="00000000000")
    TipoUsuario = models.IntegerField(default=1)

    def __str__(self):
        return self.Vinculado.first_name
