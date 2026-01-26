from rest_framework import serializers

from Usuario.serializer import UsuarioSimpleSerializer
from barbshop.models import BarberShop


class BarbshopSerializer(serializers.ModelSerializer):
    Dono = UsuarioSimpleSerializer()

    class Meta:
        model = BarberShop
        fields = ('id', 'Dono', 'Nome', 'Endereco', 'Telefone',
                  'Email', 'horario_abertura', 'horario_fechamento')
