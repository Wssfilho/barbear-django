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
    permission_classes = [IsAuthenticated, IsBarbeiro]
    authentication_classes = (JWTAuthentication,)
    serializer_class = ServiceSimpleSerializer
    queryset = Service.objects.all()

    def get_permissions(self):
        if self.action == 'list':
            self.permission_classes = [AllowAny]
        return super().get_permissions()

    def list(self, request):
        barbshop_id = request.GET.get("id")
        if not barbshop_id:
            return Response({'status': 400, 'message': 'barbshop_id é obrigatório.'}, status=400)

        services = Service.objects.filter(Barbearia_id=barbshop_id)

        if not services.exists():
            return Response({'status': 404, 'message': 'Nenhum serviço encontrado para esta barbearia'}, status=404)

        serializer = ServiceSimpleSerializer(services, many=True)
        return Response({'status': 200, 'services': serializer.data})

    def patch(self, request, pk=None):
        service = Service.objects.filter(id=pk).first()
        if not service:
            return Response({'status': 404, 'message': 'Serviço não encontrado.'}, status=404)
        Nome = request.data.get('Nome')
        Descricao = request.data.get('Descricao')
        Preco = request.data.get('Preco')
        service.Nome = Nome
        service.Descricao = Descricao
        service.Preco = Preco
        service.save()
        return Response({'status': 200, 'message': 'Serviço atualizado com sucesso.'
                         }, status=200)

    def delete(self, request, pk=None):
        service = Service.objects.filter(id=pk).first()
        if not service:
            return Response({'status': 404, 'message': 'Serviço não encontrado.'}, status=404)
        service.delete()
        return Response({'status': 200, 'message': 'Serviço deletado com sucesso.'
                         }, status=200)
