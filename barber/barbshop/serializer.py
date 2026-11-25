from rest_framework import serializers

from Usuario.serializer import UsuarioSimpleSerializer
from barbshop.models import BarberShop


class BarbshopSerializer(serializers.ModelSerializer):
    Dono = UsuarioSimpleSerializer()

    class Meta:
        model = BarberShop
        fields = ('id', 'Dono', 'Nome', 'Endereco', 'Telefone',
                  'Email', 'horario_abertura', 'horario_fechamento')


class BarbshopSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarberShop
        fields = ('id', 'Nome')


class BarbshopWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarberShop
        fields = ('Nome', 'Endereco', 'Telefone', 'Email', 'horario_abertura', 'horario_fechamento')

    def validate(self, attrs):
        opening = attrs.get('horario_abertura', getattr(self.instance, 'horario_abertura', None))
        closing = attrs.get('horario_fechamento', getattr(self.instance, 'horario_fechamento', None))
        if opening and closing and opening >= closing:
            raise serializers.ValidationError('O fechamento deve ser posterior à abertura.')
        return attrs
