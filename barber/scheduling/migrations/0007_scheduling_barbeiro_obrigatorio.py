import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('Usuario', '0002_alter_usuario_tipousuario'),
        ('scheduling', '0006_scheduling_barbeiro'),
    ]

    operations = [
        migrations.AlterField(
            model_name='scheduling',
            name='barbeiro',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='agenda_barbeiro', to='Usuario.usuario',
            ),
        ),
        migrations.AlterUniqueTogether(
            name='scheduling',
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name='scheduling',
            constraint=models.UniqueConstraint(
                fields=('barbeiro', 'data_agendamento', 'horario_agendamento'),
                name='scheduling_unique_barbeiro_horario',
            ),
        ),
    ]
