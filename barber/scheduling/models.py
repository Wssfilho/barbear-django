from django.db import models
from django.core.exceptions import ValidationError
from Usuario.models import Usuario
from service.models import Service


def validate_time_interval(value):
    """Valida se o horário está em intervalos de 20 minutos"""
    minutes = value.hour * 60 + value.minute
    if minutes % 20 != 0 or value.second or value.microsecond:
        raise ValidationError(
            'O horário deve ser em intervalos de 20 minutos (ex: 08:00, 08:20, 08:40, 09:00, etc.)'
        )


class Scheduling(models.Model):
    cliente = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    # Barbeiro responsável pelo atendimento: o dono da barbearia do serviço.
    # Persistido para restringir a agenda e a unicidade de horário por barbeiro.
    barbeiro = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='agenda_barbeiro')
    servico = models.ForeignKey(Service, on_delete=models.CASCADE)
    descricao = models.TextField(blank=True, null=True)
    data_agendamento = models.DateField()
    horario_agendamento = models.TimeField(validators=[validate_time_interval])

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['barbeiro', 'data_agendamento', 'horario_agendamento'],
                name='scheduling_unique_barbeiro_horario',
            ),
        ]

    def save(self, *args, **kwargs):
        # O barbeiro do atendimento é o dono da barbearia do serviço.
        if self.barbeiro_id is None and self.servico_id is not None:
            self.barbeiro_id = self.servico.Barbearia.Dono_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Agendamento de {self.cliente} para {self.servico} em {self.data_agendamento} às {self.horario_agendamento}"
