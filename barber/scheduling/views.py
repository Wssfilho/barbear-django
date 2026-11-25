from datetime import datetime

from django.db import IntegrityError, transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication

from Usuario.models import Usuario
from Usuario.permissions import IsCliente, TemPerfil, get_perfil
from barbshop.models import BarberShop
from service.models import Service
from .availability import available_times, available_times_for_barber, available_times_for_shop
from .models import Scheduling
from .serializer import SchedulingSerializer, SchedulingWriteSerializer


HORARIO_INDISPONIVEL = 'Horario indisponivel para agendamento'


def parse_date(value):
    try:
        return datetime.strptime(str(value), '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def invalid(message, status=400):
    return Response({'error': message}, status=status)


class schedulingModelViewSet(GenericViewSet):
    permission_classes = [IsAuthenticated, TemPerfil]
    authentication_classes = (JWTAuthentication,)
    serializer_class = SchedulingSerializer

    def get_permissions(self):
        if self.action == 'available_times':
            return [AllowAny()]
        if self.action == 'create':
            return [IsAuthenticated(), IsCliente()]
        return super().get_permissions()

    def get_queryset(self):
        perfil = get_perfil(self.request.user)
        queryset = Scheduling.objects.select_related(
            'cliente__Vinculado', 'barbeiro__Vinculado', 'servico__Barbearia')
        if perfil.is_barbeiro:
            queryset = queryset.filter(barbeiro=perfil)
        else:
            queryset = queryset.filter(cliente=perfil)
        return queryset.order_by('data_agendamento', 'horario_agendamento', 'id')

    def list(self, request):
        queryset = self.get_queryset()
        date_str = request.query_params.get('date')
        if date_str:
            day = parse_date(date_str)
            if not day:
                return invalid('Formato de data inválido. Use YYYY-MM-DD')
            queryset = queryset.filter(data_agendamento=day)
        return Response(self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def available_times(self, request):
        day = parse_date(request.query_params.get('date'))
        if not day:
            return invalid('Informe uma data no formato YYYY-MM-DD.')
        shop_id = request.query_params.get('barbearia')
        barber_id = request.query_params.get('barbeiro')
        service_id = request.query_params.get('servico')
        shop = None
        # O serviço é um filtro opcional para compatibilidade com clientes existentes.
        if service_id:
            service = Service.objects.select_related('Barbearia__Dono').filter(
                pk=service_id if service_id.isdigit() else None).first()
            if not service:
                return invalid('Serviço não encontrado', status=404)
            shop = service.Barbearia
            if shop_id and str(shop.pk) != shop_id:
                return invalid('O serviço informado não pertence a esta barbearia')
        elif shop_id:
            shop = BarberShop.objects.select_related('Dono').filter(
                pk=shop_id if shop_id.isdigit() else None).first()
            if not shop:
                return invalid('Barbearia não encontrada', status=404)
        if shop:
            barber = shop.Dono
            if barber_id and str(barber.pk) != barber_id:
                return invalid('O barbeiro informado não atende nesta barbearia')
        elif barber_id:
            barber = Usuario.objects.filter(pk=barber_id if barber_id.isdigit() else None).first()
        else:
            return invalid('Informe o barbeiro ou a barbearia')
        if not barber or not barber.is_barbeiro:
            return invalid('Barbeiro não encontrado', status=404)
        slots = available_times_for_shop(shop, day) if shop else available_times_for_barber(barber, day)
        return Response({'date': day.isoformat(), 'barbeiro': barber.pk, 'available_times': slots})

    def create(self, request):
        serializer = SchedulingWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        service = data['servico']
        barber_id = request.data.get('barbeiro')
        if barber_id not in (None, '') and str(barber_id) != str(service.Barbearia.Dono_id):
            return invalid('O serviço escolhido não pertence a este barbeiro')
        # Serializa reservas do profissional, inclusive entre serviços/lojas diferentes.
        try:
            with transaction.atomic():
                owner = Usuario.objects.select_for_update().get(pk=service.Barbearia.Dono_id)
                if not owner.is_barbeiro:
                    raise ValidationError({'error': 'O profissional não está disponível.'})
                if data['horario_agendamento'].strftime('%H:%M') not in available_times(service, data['data_agendamento']):
                    return invalid(HORARIO_INDISPONIVEL)
                booking = Scheduling.objects.create(
                    cliente=get_perfil(request.user), barbeiro=owner, **data)
        except IntegrityError:
            return invalid(HORARIO_INDISPONIVEL)
        return Response({'message': 'Agendamento criado com sucesso',
                         'scheduling': SchedulingSerializer(booking).data}, status=201)

    def destroy(self, request, pk=None):
        self.get_object().delete()
        return Response({'message': 'Agendamento cancelado com sucesso'})
