from django.conf import settings
from django.db import models


class Plan(models.Model):
    barbershop = models.ForeignKey('barbshop.BarberShop', on_delete=models.CASCADE)
    service = models.ForeignKey('service.Service', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=1000, blank=True, default='')
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2)
    included_visits = models.PositiveSmallIntegerField()
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['monthly_price', 'id']
        constraints = [
            models.CheckConstraint(condition=models.Q(monthly_price__gte=0), name='assistant_plan_price_nonnegative'),
            models.CheckConstraint(condition=models.Q(included_visits__gte=1, included_visits__lte=100), name='assistant_plan_visits_range'),
        ]

    def __str__(self):
        return self.name


class AssistantUsage(models.Model):
    # One row per user; no prompts, provider output or personal data are saved.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    window_started = models.DateTimeField()
    count = models.PositiveIntegerField(default=0)
    last_started = models.DateTimeField(null=True)
    recent = models.JSONField(default=dict)
