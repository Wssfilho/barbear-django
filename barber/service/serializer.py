from rest_framework import serializers

from Usuario.serializer import UsuarioSimpleSerializer
from barbshop.serializer import BarbshopSimpleSerializer
from .models import Service


class ServiceSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ('id', 'Nome',
                  'Descricao', 'Preco')


class ServiceDetailSerializer(serializers.ModelSerializer):
    Barbearia = BarbshopSimpleSerializer(read_only=True)

    class Meta:
        model = Service
        fields = ('id', 'Barbearia', 'Nome', 'Descricao', 'Preco')


class ServiceWriteSerializer(serializers.ModelSerializer):
    """Criação/edição de serviços; a barbearia precisa pertencer ao barbeiro."""

    class Meta:
        model = Service
        fields = ('id', 'Barbearia', 'Nome', 'Descricao', 'Preco')
        extra_kwargs = {'Descricao': {'required': False, 'allow_blank': True}}

    def validate_Barbearia(self, barbearia):
        perfil = self.context['perfil']
        if barbearia.Dono_id != perfil.id:
            raise serializers.ValidationError('Você só pode gerenciar serviços das suas barbearias.')
        return barbearia

    def validate_Preco(self, preco):
        if preco < 0:
            raise serializers.ValidationError('O preço não pode ser negativo.')
        return preco
