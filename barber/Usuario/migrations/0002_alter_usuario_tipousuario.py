from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('Usuario', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usuario',
            name='TipoUsuario',
            field=models.IntegerField(choices=[(1, 'Cliente'), (2, 'Barbeiro')], default=1),
        ),
    ]
