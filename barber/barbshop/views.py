# Create your views here.
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import JsonResponse
from .models import BarberShop, Usuario
from .serializer import BarbshopSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from .permissions import IsBarbeiro


class BarbshopModelViewSet(ModelViewSet):
    # Definindo autenticação e permissões - APENAS BARBEIROS
    permission_classes = [IsAuthenticated, IsBarbeiro]
    authentication_classes = (JWTAuthentication,)
    serializer_class = BarbshopSerializer
    queryset = BarberShop.objects.all()

    def list(self, request):
        usuario = Usuario.objects.get(Vinculado=request.user)
        barbershops = BarberShop.objects.filter(Dono=usuario)
        serializer = BarbshopSerializer(barbershops, many=True)
        return Response({'status': 200, 'barbershops': serializer.data})

    def create(self, request):
        usuario = Usuario.objects.get(Vinculado=request.user)
        Nome = request.data.get('Nome')
        Endereco = request.data.get('Endereco')
        Telefone = request.data.get('Telefone')
        Email = request.data.get('Email')
        horario_abertura = request.data.get('horario_abertura')
        horario_fechamento = request.data.get('horario_fechamento')
        if not all([Nome, Endereco, Telefone, Email, horario_abertura, horario_fechamento]):
            return Response({'status': 400, 'message': 'Todos os campos são obrigatórios.'})
        barbshop = BarberShop.objects.create(
            Dono=usuario,
            Nome=Nome,
            Endereco=Endereco,
            Telefone=Telefone,
            Email=Email,
            horario_abertura=horario_abertura,
            horario_fechamento=horario_fechamento
        )
        return Response({'status': 201, 'message': 'Barbearia criada com sucesso.', 'barbshop_id': barbshop.id})

    def update(self, request, pk=None):
        usuario = Usuario.objects.get(Vinculado=request.user)
        try:
            barbshop = BarberShop.objects.get(id=pk, Dono=usuario)
        except BarberShop.DoesNotExist:
            return Response({'status': 404, 'message': 'Barbearia não encontrada.'})
        Nome = request.data.get('Nome')
        Endereco = request.data.get('Endereco')
        Telefone = request.data.get('Telefone')
        Email = request.data.get('Email')
        horario_abertura = request.data.get('horario_abertura')
        horario_fechamento = request.data.get('horario_fechamento')
        if not all([Nome, Endereco, Telefone, Email, horario_abertura, horario_fechamento]):
            return Response({'status': 400, 'message': 'Todos os campos são obrigatórios.'})
        barbshop.Nome = Nome
        barbshop.Endereco = Endereco
        barbshop.Telefone = Telefone
        barbshop.Email = Email
        barbshop.horario_abertura = horario_abertura
        barbshop.horario_fechamento = horario_fechamento
        barbshop.save()
        return Response({'status': 200, 'message': 'Barbearia atualizada com sucesso.'})

    def delete(self, request, pk=None):
        usuario = Usuario.objects.get(Vinculado=request.user)
        try:
            barbshop = BarberShop.objects.get(id=pk, Dono=usuario)
        except BarberShop.DoesNotExist:
            return Response({'status': 404, 'message': 'Barbearia não encontrada.'})
        barbshop.delete()
        return Response({'status': 200, 'message': 'Barbearia deletada com sucesso.'})
