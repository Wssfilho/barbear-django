from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Usuario


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email')


class UsuarioSerializer(serializers.ModelSerializer):
    Vinculado = UserSerializer()

    class Meta:
        model = Usuario
        fields = ('id', 'Vinculado', 'Telefone',
                  'TipoUsuario')


class UsuarioSimpleSerializer(serializers.ModelSerializer):
    nome = serializers.CharField(source='Vinculado.first_name')

    class Meta:
        model = Usuario
        fields = ('id', 'nome')
