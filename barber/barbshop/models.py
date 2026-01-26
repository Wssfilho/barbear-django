from django.db import models
from Usuario.models import Usuario
# Create your models here.


class BarberShop(models.Model):
    Dono = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    Nome = models.CharField(max_length=100)
    Endereco = models.CharField(max_length=255)
    Telefone = models.CharField(max_length=15)
    Email = models.EmailField()
    horario_abertura = models.TimeField()
    horario_fechamento = models.TimeField()

    def __str__(self):
        return self.Nome
