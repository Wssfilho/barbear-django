from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.contrib.auth.hashers import make_password
from rest_framework.response import Response
from django.http import JsonResponse
from django.contrib.auth.models import User
from .models import Usuario
from .serializer import UsuarioSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication


class UsuarioModelViewSet(ModelViewSet):
    # Definindo autenticação e permissões
    permission_classes = (IsAuthenticated,)
    authentication_classes = (JWTAuthentication,)
    serializer_class = UsuarioSerializer
    queryset = Usuario.objects.all()

    # Listar todos os usuários
    def list(self, request):
        usuarios = Usuario.objects.all()
        serializer = UsuarioSerializer(usuarios, many=True)
        if serializer.data:
            return Response({'status': 302, 'Usuario': serializer.data})
        return Response({'status': 204, 'msg': 'No Content'})

    # Retornar os dados do usuário autenticado
    @action(methods=["get"], detail=False)
    def me(self, request):
        usuario = Usuario.objects.get(Vinculado=request.user)
        serializer = UsuarioSerializer(usuario)
        return Response({'status': 302, 'Usuario': serializer.data})
    # Ainda não sei como funciona o action!
    # Criar um novo usuário

    def create(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        hashed_password = make_password(password)
        user_exists = User.objects.filter(username=username).exists()

        first_name = request.data.get('first_name')
        email = request.data.get('email')
        telefone = request.data.get('telefone')
        cpf = request.data.get('cpf')
        tipo_usuario = request.data.get('tipo_usuario', 1)
        if not username or not password or not first_name or not email:
            return Response({'status': 400, 'msg': 'Missing required fields'})

        user = User.objects.create(
            username=username, password=hashed_password, email=email, first_name=first_name, last_name=""
        )

        usuario = Usuario.objects.create(
            Vinculado=user, Telefone=telefone, cpf=cpf, TipoUsuario=tipo_usuario
        )

        return Response({'status': 201, 'msg': 'User registered successfully'})

    # Atualizar as inform9ações de um usuário
    def patch(self, request):
        usuario = Usuario.objects.get(Vinculado=request.user)
        first_name = request.data.get('first_name')
        email = request.data.get('email')
        telefone = request.data.get('telefone')
        cpf = request.data.get('cpf')

        usuario.Vinculado.first_name = first_name
        usuario.Vinculado.email = email
        usuario.Telefone = telefone
        usuario.cpf = cpf

        usuario.Vinculado.save()
        usuario.save()

        return Response({'status': 200, 'msg': 'User updated successfully'})

    # Deletar um usuário
    def delete(self, request):
        user_id = request.GET.get('id')
        usuario = Usuario.objects.get(id=user_id)
        usuario.Vinculado.delete()  # Deleta o User relacionado
        usuario.delete()  # Deleta o Usuario
        return Response({'status': 200, 'msg': 'User deleted successfully'})
