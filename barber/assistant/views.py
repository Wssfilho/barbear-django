from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from Usuario.permissions import IsBarbeiro, IsCliente, get_perfil
from barbshop.models import BarberShop
from service.models import Service
from . import provider
from .finance import compare, money
from .models import Plan
from .quota import reserve
from .serializers import PlanSerializer, RecommendSerializer

CATALOG_LIMIT = 100


def positive_id(value):
    if not isinstance(value, str) or len(value) > 19 or not value.isascii() or not value.isdigit() or not 0 < int(value) <= 9223372036854775807:
        raise ValidationError({'barbearia': 'Selecione uma barbearia válida.'})
    return int(value)


class BaseView(APIView):
    authentication_classes = (JWTAuthentication,)


class PlansView(BaseView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsAuthenticated(), IsBarbeiro()]

    def get(self, request):
        shop_id = positive_id(request.query_params.get('barbearia'))
        get_object_or_404(BarberShop, pk=shop_id)
        plans = Plan.objects.filter(barbershop_id=shop_id, active=True, service__Barbearia_id=F('barbershop_id')).select_related('service')[:CATALOG_LIMIT]
        return Response({'plans': PlanSerializer(plans, many=True).data})

    def post(self, request):
        serializer = PlanSerializer(data=request.data, context={'profile': get_perfil(request.user)})
        serializer.is_valid(raise_exception=True)
        # Serialize creation per shop to keep the public comparison catalog complete.
        with transaction.atomic():
            shop = serializer.validated_data['barbershop']
            BarberShop.objects.select_for_update().get(pk=shop.pk)
            if Plan.objects.filter(barbershop=shop).count() >= CATALOG_LIMIT:
                raise ValidationError({'detail': 'Limite de cem planos por barbearia atingido.'})
            serializer.save()
        return Response({'plan': serializer.data}, status=201)


class MyPlansView(BaseView):
    permission_classes = (IsAuthenticated, IsBarbeiro)

    def get(self, request):
        plans = Plan.objects.filter(barbershop__Dono=get_perfil(request.user)).select_related('barbershop', 'service')
        return Response({'plans': PlanSerializer(plans, many=True).data})


class PlanDetailView(BaseView):
    permission_classes = (IsAuthenticated, IsBarbeiro)

    def owned(self, request, pk):
        plan = get_object_or_404(Plan.objects.select_related('barbershop', 'service'), pk=pk)
        if plan.barbershop.Dono_id != get_perfil(request.user).pk:
            raise PermissionDenied('Você só pode gerenciar planos das suas barbearias.')
        return plan

    def patch(self, request, pk):
        with transaction.atomic():
            # Serialize partial edits so concurrent service/shop changes cannot mix.
            plan = get_object_or_404(Plan.objects.select_for_update(), pk=pk)
            if plan.barbershop.Dono_id != get_perfil(request.user).pk:
                raise PermissionDenied('Você só pode gerenciar planos das suas barbearias.')
            serializer = PlanSerializer(plan, data=request.data, partial=True, context={'profile': get_perfil(request.user)})
            serializer.is_valid(raise_exception=True)
            target = serializer.validated_data.get('barbershop', plan.barbershop)
            BarberShop.objects.select_for_update().get(pk=target.pk)
            if target.pk != plan.barbershop_id and Plan.objects.filter(barbershop=target).count() >= CATALOG_LIMIT:
                raise ValidationError({'detail': 'Limite de cem planos por barbearia atingido.'})
            serializer.save()
        return Response({'plan': serializer.data})

    def delete(self, request, pk):
        self.owned(request, pk).delete()
        return Response(status=204)


class AssistantStatusView(BaseView):
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response({'available': provider.available()})


class RecommendView(BaseView):
    permission_classes = (IsAuthenticated, IsCliente)

    def post(self, request):
        # Bound parsing before JSON decoding; recommend accepts only small objects.
        if len(request.body) > 8192:
            raise ValidationError({'detail': 'Solicitação muito extensa.'})
        serializer = RecommendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        service = Service.objects.filter(pk=data['service_id'], Barbearia_id=data['barbershop_id']).first()
        if service is None or service.Preco < 0:
            raise ValidationError({'service_id': 'Selecione um serviço válido da barbearia informada.'})
        plans = list(Plan.objects.filter(barbershop_id=data['barbershop_id'], service=service, active=True)[:CATALOG_LIMIT+1])
        if len(plans) > CATALOG_LIMIT:
            raise ValidationError({'detail': 'Catálogo de planos excede o limite permitido.'})
        try:
            provider.configuration()
            reserve(request.user, data)
            haircuts = provider.recommend_haircuts(data)
        except provider.ProviderError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)
        return Response({
            'summary': 'Sugestões de cortes para as preferências informadas. Confirme a execução com o profissional; a comparação usa os preços cadastrados e a frequência informada.',
            'haircuts': haircuts,
            'comparison': compare(service, plans, data['monthly_visits'], data['monthly_budget']),
            'service': {'id': service.pk, 'name': service.Nome, 'price': money(service.Preco), 'barbershop_id': service.Barbearia_id},
        })
