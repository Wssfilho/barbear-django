# Create your views here.
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import BarberShop
from .serializer import BarbshopSerializer, BarbshopWriteSerializer
from .permissions import IsBarbeiro, get_perfil


class BarbshopModelViewSet(GenericViewSet):
    # Leitura pública; escrita APENAS pelo barbeiro dono da barbearia
    permission_classes = [IsAuthenticated, IsBarbeiro]
    authentication_classes = (JWTAuthentication,)
    serializer_class = BarbshopSerializer
    queryset = BarberShop.objects.select_related('Dono__Vinculado')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return super().get_permissions()

    def list(self, request):
        barbershops = self.get_queryset().order_by('Nome', 'id')
        serializer = BarbshopSerializer(barbershops, many=True)
        return Response({'status': 200, 'barbershops': serializer.data})

    def retrieve(self, request, pk=None):
        barbshop = self.get_queryset().filter(pk=pk).first()
        if not barbshop:
            return Response({'status': 404, 'message': 'Barbearia não encontrada.'}, status=404)
        return Response({'status': 200, 'barbshop': BarbshopSerializer(barbshop).data})

    # Barbearias do barbeiro autenticado
    @action(detail=False, methods=['get'])
    def mine(self, request):
        barbershops = self.get_queryset().filter(Dono=get_perfil(request.user)).order_by('Nome', 'id')
        return Response({'status': 200, 'barbershops': BarbshopSerializer(barbershops, many=True).data})

    def _da_conta(self, request, pk):
        return BarberShop.objects.filter(id=pk, Dono=get_perfil(request.user)).first()

    def create(self, request):
        serializer = BarbshopWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shop = serializer.save(Dono=get_perfil(request.user))
        return Response({'status': 201, 'message': 'Barbearia criada com sucesso.',
                         'barbshop_id': shop.id, 'barbshop': BarbshopSerializer(shop).data}, status=201)

    def update(self, request, pk=None, partial=False):
        shop = self._da_conta(request, pk)
        if not shop:
            return Response({'message': 'Barbearia não encontrada.'}, status=404)
        serializer = BarbshopWriteSerializer(shop, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'status': 200, 'barbshop': BarbshopSerializer(shop).data})

    def partial_update(self, request, pk=None):
        return self.update(request, pk, partial=True)

    def destroy(self, request, pk=None):
        barbshop = self._da_conta(request, pk)
        if not barbshop:
            return Response({'status': 404, 'message': 'Barbearia não encontrada.'}, status=404)
        barbshop.delete()
        return Response({'status': 200, 'message': 'Barbearia deletada com sucesso.'})
