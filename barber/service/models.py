from django.db import models
from Usuario.models import Usuario
from barbshop.models import BarberShop
# Create your models here.


class Service(models.Model):
    Barbearia = models.ForeignKey(BarberShop, on_delete=models.CASCADE)
    Nome = models.CharField(max_length=100)
    Descricao = models.TextField()
    Preco = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.Nome
