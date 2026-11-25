from rest_framework import serializers
from .models import Scheduling
from Usuario.serializer import UsuarioSerializer, UsuarioSimpleSerializer
from barbshop.serializer import BarbshopSimpleSerializer
from service.serializer import ServiceSimpleSerializer
from service.models import Service
from .models import validate_time_interval


class SchedulingSerializer(serializers.ModelSerializer):
    cliente = UsuarioSerializer()
    barbeiro = UsuarioSimpleSerializer(read_only=True)
    barbearia = BarbshopSimpleSerializer(source='servico.Barbearia', read_only=True)
    servico = ServiceSimpleSerializer()

    class Meta:
        model = Scheduling
        fields = ('id', 'cliente', 'barbeiro', 'barbearia', 'servico', 'descricao',
                  'data_agendamento', 'horario_agendamento')


class SchedulingWriteSerializer(serializers.Serializer):
    servico = serializers.PrimaryKeyRelatedField(queryset=Service.objects.select_related('Barbearia'))
    descricao = serializers.CharField(required=False, allow_blank=True, default='', max_length=2000)
    data_agendamento = serializers.DateField()
    horario_agendamento = serializers.TimeField(validators=[validate_time_interval])
