from decimal import Decimal
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from barbshop.models import BarberShop
from service.models import Service
from .models import Plan


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict) and set(data) - set(self.fields):
            raise serializers.ValidationError({'detail': 'Campos desconhecidos na solicitação.'})
        return super().to_internal_value(data)


class PlanSerializer(serializers.ModelSerializer):
    barbershop_id = serializers.PrimaryKeyRelatedField(source='barbershop', queryset=BarberShop.objects.all())
    service_id = serializers.PrimaryKeyRelatedField(source='service', queryset=Service.objects.select_related('Barbearia').all())
    monthly_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'))
    included_visits = serializers.IntegerField(min_value=1, max_value=100)

    class Meta:
        model = Plan
        fields = ('id', 'barbershop_id', 'service_id', 'name', 'description', 'monthly_price', 'included_visits', 'active')

    def validate(self, attrs):
        shop = attrs.get('barbershop', getattr(self.instance, 'barbershop', None))
        service = attrs.get('service', getattr(self.instance, 'service', None))
        profile = self.context['profile']
        if shop.Dono_id != profile.id or service.Barbearia.Dono_id != profile.id:
            raise PermissionDenied('Você só pode gerenciar planos das suas barbearias.')
        if service.Barbearia_id != shop.pk:
            raise serializers.ValidationError({'service_id': 'O serviço deve pertencer à barbearia selecionada.'})
        return attrs


class RecommendSerializer(StrictSerializer):
    barbershop_id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
    service_id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
    hair_type = serializers.ChoiceField(choices=('straight', 'wavy', 'curly', 'coily'))
    hair_length = serializers.ChoiceField(choices=('short', 'medium', 'long'))
    style = serializers.ChoiceField(choices=('classic', 'modern', 'discreet', 'bold'))
    maintenance = serializers.ChoiceField(choices=('low', 'medium', 'high'))
    monthly_visits = serializers.IntegerField(min_value=1, max_value=8)
    monthly_budget = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'), allow_null=True, required=False, default=None)
    preferences = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class HaircutSerializer(StrictSerializer):
    name = serializers.CharField(max_length=80)
    reason = serializers.CharField(max_length=400)
    maintenance = serializers.CharField(max_length=200)


class ProviderOutputSerializer(StrictSerializer):
    haircuts = HaircutSerializer(many=True, min_length=1, max_length=3)
