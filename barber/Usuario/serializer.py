import re

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import Usuario


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email')


class UsuarioSerializer(serializers.ModelSerializer):
    Vinculado = UserSerializer()
    perfil = serializers.CharField(read_only=True)
    tipo_usuario = serializers.IntegerField(source='TipoUsuario', read_only=True)

    class Meta:
        model = Usuario
        fields = ('id', 'Vinculado', 'Telefone', 'perfil', 'tipo_usuario')


class UsuarioMeSerializer(UsuarioSerializer):
    """Perfil do próprio usuário autenticado (inclui CPF)."""

    class Meta(UsuarioSerializer.Meta):
        fields = UsuarioSerializer.Meta.fields + ('cpf',)


class UsuarioSimpleSerializer(serializers.ModelSerializer):
    nome = serializers.CharField(source='Vinculado.first_name')

    class Meta:
        model = Usuario
        fields = ('id', 'nome')


def _digits(field, size_min, size_max):
    def validate(value):
        if not re.fullmatch(r'\d{%d,%d}' % (size_min, size_max), value or ''):
            if size_min == size_max:
                raise serializers.ValidationError(f'{field} deve ter {size_min} dígitos.')
            raise serializers.ValidationError(f'{field} deve ter de {size_min} a {size_max} dígitos.')
        return value
    return validate


class ClienteCadastroSerializer(serializers.Serializer):
    """
    Cadastro público. Sempre cria um perfil de cliente: o tipo de usuário
    não é aceito do corpo da requisição.
    """
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    telefone = serializers.CharField(validators=[_digits('Telefone', 10, 11)])
    cpf = serializers.CharField(validators=[_digits('CPF', 11, 11)])

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Este usuário já está em uso.')
        return value

    def validate(self, attrs):
        user = User(username=attrs['username'], email=attrs['email'], first_name=attrs['first_name'])
        try:
            validate_password(attrs['password'], user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': list(error.messages)})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name='',
        )
        return Usuario.objects.create(
            Vinculado=user,
            Telefone=validated_data['telefone'],
            cpf=validated_data['cpf'],
            TipoUsuario=Usuario.CLIENTE,
        )


class PerfilUpdateSerializer(serializers.Serializer):
    """Atualização parcial do próprio perfil. Não altera o tipo de usuário."""
    first_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(max_length=254, required=False)
    telefone = serializers.CharField(required=False, validators=[_digits('Telefone', 10, 11)])
    cpf = serializers.CharField(required=False, validators=[_digits('CPF', 11, 11)])

    def update(self, usuario, validated_data):
        user = usuario.Vinculado
        for field in ('first_name', 'email'):
            if field in validated_data:
                setattr(user, field, validated_data[field])
        if 'telefone' in validated_data:
            usuario.Telefone = validated_data['telefone']
        if 'cpf' in validated_data:
            usuario.cpf = validated_data['cpf']
        with transaction.atomic():
            user.save()
            usuario.save()
        return usuario


def first_error(errors):
    """Extrai a primeira mensagem legível de um dicionário de erros do DRF."""
    if isinstance(errors, dict):
        for value in errors.values():
            message = first_error(value)
            if message:
                return message
    elif isinstance(errors, (list, tuple)):
        for value in errors:
            message = first_error(value)
            if message:
                return message
    elif errors:
        return str(errors)
    return None
