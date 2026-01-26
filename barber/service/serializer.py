from rest_framework import serializers

from Usuario.serializer import UsuarioSimpleSerializer
from barbshop.serializer import BarbshopSimpleSerializer
from .models import Service


class ServiceSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ('id', 'Nome',
                  'Descricao', 'Preco')
