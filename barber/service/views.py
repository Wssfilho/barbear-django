# Create your views here.
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import JsonResponse
from .models import BarberShop, Usuario, Service
from .serializer import ServiceSimpleSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from barbshop.permissions import IsBarbeiro


class ServiceModelViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]
    authentication_classes = (JWTAuthentication,)
    serializer_class = ServiceSimpleSerializer
    queryset = BarberShop.objects.all()

    def list(self, request):
        # Obtém o nome da barbearia do body da requisição
        nome_barbearia = request.data.get('barbearia', None)

        if not nome_barbearia:
            return Response({
                'error': 'O campo nome_barbearia é obrigatório no body'
            }, status=400)

        # Filtra os serviços pela barbearia com o nome informado
        services = Service.objects.filter(
            Barbearia__Nome__icontains=nome_barbearia
        )

        if not services.exists():
            return Response({
                'message': 'Nenhum serviço encontrado para esta barbearia'
            }, status=404)

        serializer = self.get_serializer(services, many=True)
        return Response(serializer.data)
