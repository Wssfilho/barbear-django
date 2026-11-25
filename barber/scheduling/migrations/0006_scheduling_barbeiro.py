import django.db.models.deletion
from django.db import migrations, models


def preencher_barbeiro(apps, schema_editor):
    """O barbeiro de reservas existentes é o dono da barbearia do serviço."""
    Scheduling = apps.get_model('scheduling', 'Scheduling')
    for item in Scheduling.objects.select_related('servico__Barbearia').iterator():
        item.barbeiro_id = item.servico.Barbearia.Dono_id
        item.save(update_fields=['barbeiro'])


class Migration(migrations.Migration):

    dependencies = [
        ('Usuario', '0002_alter_usuario_tipousuario'),
        ('barbshop', '0001_initial'),
        ('service', '0003_remove_service_data'),
        ('scheduling', '0005_scheduling_descricao'),
    ]

    operations = [
        migrations.AddField(
            model_name='scheduling',
            name='barbeiro',
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='agenda_barbeiro', to='Usuario.usuario',
            ),
        ),
        migrations.RunPython(preencher_barbeiro, migrations.RunPython.noop),
    ]
