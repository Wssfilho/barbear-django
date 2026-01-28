# Create your views here.
from datetime import datetime, time, timedelta
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import JsonResponse
from Usuario.models import Usuario
from service.models import Service
from .models import Scheduling
from .serializer import SchedulingSerializer, ServiceSimpleSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from barbshop.permissions import IsBarbeiro


class schedulingModelViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, IsBarbeiro]
    authentication_classes = (JWTAuthentication,)
    serializer_class = SchedulingSerializer
    queryset = Scheduling.objects.all()

    def get_permissions(self):
        if self.action == 'list':
            self.permission_classes = [IsBarbeiro]
        return super().get_permissions()

    def list(self, request):
        usuario = Usuario.objects.get(Vinculado=request.user)
        scheluings = Scheduling.objects.filter(cliente=usuario)
        serializer = SchedulingSerializer(scheluings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def available_times(self, request):
        """Retorna horários disponíveis para uma data específica"""
        date_str = request.query_params.get('date')

        if not date_str:
            return Response({'error': 'Data não fornecida'}, status=400)

        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Formato de data inválido. Use YYYY-MM-DD'}, status=400)

        # Gera todos os horários de 20 em 20 minutos (ex: 08:00 às 18:00)
        start_hour = 8
        end_hour = 18
        all_times = []

        current = datetime.combine(date, time(start_hour, 0))
        end = datetime.combine(date, time(end_hour, 0))

        while current <= end:
            all_times.append(current.time().strftime('%H:%M'))
            current += timedelta(minutes=20)

        # Busca horários já agendados para essa data
        scheduled = Scheduling.objects.filter(
            data_agendamento=date
        ).values_list('horario_agendamento', flat=True)

        scheduled_times = [t.strftime('%H:%M') for t in scheduled]

        # Retorna apenas os horários disponíveis
        available = [t for t in all_times if t not in scheduled_times]

        return Response({
            'date': date_str,
            'available_times': available,
        })

    def create(self, request):
        usuario = Usuario.objects.get(Vinculado=request.user)
        service = request.data.get('servico')
        servico = Service.objects.get(id=service)
        pode_agendar = Scheduling.objects.filter(
            data_agendamento=request.data.get('data_agendamento'),
            horario_agendamento=request.data.get('horario_agendamento')
        ).exists()
        if pode_agendar:
            return Response({'error': 'Horario indisponivel para agendamento'}, status=400)
        desc = request.data.get('descricao')
        data_agendamento = request.data.get('data_agendamento')
        horario_agendamento = request.data.get('horario_agendamento')
        if not service or not data_agendamento or not horario_agendamento:
            return Response({'error': 'Serviço, data ou horário não fornecidos'}, status=400)
        scheduling = Scheduling.objects.create(
            cliente=usuario,
            servico=servico,
            descricao=desc,
            data_agendamento=data_agendamento,
            horario_agendamento=horario_agendamento
        )
        return Response({'message': 'Agendamento criado com sucesso', 'scheduling': SchedulingSerializer(scheduling).data}, status=201)

    def destroy(self, request, pk=None):
        try:
            scheduling = Scheduling.objects.get(pk=pk)
        except Scheduling.DoesNotExist:
            return Response({'error': 'Agendamento não encontrado'}, status=404)
        scheduling.delete()
        return Response({'message': 'Agendamento cancelado com sucesso'}, status=200)
