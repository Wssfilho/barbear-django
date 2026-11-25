from django.contrib import admin
from .models import Scheduling
# Register your models here.


@admin.register(Scheduling)
class SchedulingAdmin(admin.ModelAdmin):
    list_display = ('id', 'data_agendamento', 'horario_agendamento', 'cliente', 'barbeiro', 'servico')
    list_filter = ('data_agendamento', 'barbeiro')
    # O barbeiro é derivado do dono da barbearia do serviço (Scheduling.save).
    readonly_fields = ('barbeiro',)
