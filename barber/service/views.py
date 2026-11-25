# Create your views here.
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication
from Usuario.serializer import first_error
from .models import Service
from .serializer import ServiceDetailSerializer, ServiceSimpleSerializer, ServiceWriteSerializer
from barbshop.permissions import IsBarbeiro, get_perfil


class ServiceModelViewSet(GenericViewSet):
    # Catálogo público; escrita apenas pelo barbeiro dono da barbearia do serviço
    permission_classes = [IsAuthenticated, IsBarbeiro]
    authentication_classes = (JWTAuthentication,)
    serializer_class = ServiceSimpleSerializer
    queryset = Service.objects.select_related('Barbearia')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return super().get_permissions()

    def list(self, request):
        services = self.get_queryset().order_by('Nome', 'id')
        if 'id' in request.query_params:
            barbshop_id = request.query_params['id']
            if not barbshop_id or not barbshop_id.isascii() or not barbshop_id.isdigit():
                return Response({'status': 400, 'message': 'Informe um id de barbearia numérico.'}, status=400)
            services = services.filter(Barbearia_id=barbshop_id)

        serializer = ServiceDetailSerializer(services, many=True)
        return Response({'status': 200, 'services': serializer.data})

    def retrieve(self, request, pk=None):
        service = self.get_queryset().filter(pk=pk).first()
        if not service:
            return Response({'status': 404, 'message': 'Serviço não encontrado.'}, status=404)
        return Response({'status': 200, 'service': ServiceDetailSerializer(service).data})

    # Serviços das barbearias do barbeiro autenticado
    @action(detail=False, methods=['get'])
    def mine(self, request):
        services = self.get_queryset().filter(Barbearia__Dono=get_perfil(request.user)).order_by('Barbearia__Nome', 'Nome')
        return Response({'status': 200, 'services': ServiceDetailSerializer(services, many=True).data})

    def _do_barbeiro(self, request, pk):
        return self.get_queryset().filter(id=pk, Barbearia__Dono=get_perfil(request.user)).first()

    def _salvar(self, request, instance=None, partial=False):
        serializer = ServiceWriteSerializer(
            instance, data=request.data, partial=partial, context={'perfil': get_perfil(request.user)})
        if not serializer.is_valid():
            return None, Response({'status': 400, 'message': first_error(serializer.errors), 'errors': serializer.errors}, status=400)
        return serializer.save(), None

    def create(self, request):
        service, error = self._salvar(request)
        if error:
            return error
        return Response({'status': 201, 'message': 'Serviço criado com sucesso.',
                         'service': ServiceDetailSerializer(service).data}, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None, partial=False):
        service = self._do_barbeiro(request, pk)
        if not service:
            return Response({'status': 404, 'message': 'Serviço não encontrado.'}, status=404)
        service, error = self._salvar(request, service, partial)
        if error:
            return error
        return Response({'status': 200, 'message': 'Serviço atualizado com sucesso.',
                         'service': ServiceDetailSerializer(service).data}, status=200)

    def partial_update(self, request, pk=None):
        return self.update(request, pk, partial=True)

    def destroy(self, request, pk=None):
        service = self._do_barbeiro(request, pk)
        if not service:
            return Response({'status': 404, 'message': 'Serviço não encontrado.'}, status=404)
        service.delete()
        return Response({'status': 200, 'message': 'Serviço deletado com sucesso.'
                         }, status=200)
