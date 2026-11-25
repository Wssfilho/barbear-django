from django.contrib import admin


from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    # Contas de barbeiro são criadas/promovidas aqui (TipoUsuario = Barbeiro);
    # o cadastro público da API sempre cria clientes.
    list_display = ('id', 'Vinculado', 'TipoUsuario', 'Telefone')
    list_filter = ('TipoUsuario',)
    search_fields = ('Vinculado__username', 'Vinculado__first_name', 'Vinculado__email')

# Register your models here.
