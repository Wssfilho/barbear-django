from rest_framework import serializers
from .models import Scheduling
from Usuario.serializer import UsuarioSerializer
from service.serializer import ServiceSimpleSerializer


class SchedulingSerializer(serializers.ModelSerializer):
    cliente = UsuarioSerializer()
    servico = ServiceSimpleSerializer()

    class Meta:
        model = Scheduling
        fields = ('id', 'cliente', 'servico', 'descricao',
                  'data_agendamento', 'horario_agendamento')
