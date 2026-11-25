from datetime import datetime, time, timedelta

from django.utils import timezone
from .models import Scheduling


SLOT_MINUTES = 20


def business_slots(shop, day):
    """Inícios de atendimento alinhados à grade de 20 minutos do expediente."""
    opening = datetime.combine(day, shop.horario_abertura)
    closing = datetime.combine(day, shop.horario_fechamento)
    if closing <= opening:
        return []
    minutes = opening.hour * 60 + opening.minute
    first_minute = ((minutes + SLOT_MINUTES - 1) // SLOT_MINUTES) * SLOT_MINUTES
    current = datetime.combine(day, time()) + timedelta(minutes=first_minute)
    if current < opening:
        current += timedelta(minutes=SLOT_MINUTES)
    slots = []
    while current < closing:
        slots.append(current.time())
        current += timedelta(minutes=SLOT_MINUTES)
    return slots


def _available_for_shops(shops, barber_id, day):
    now = timezone.localtime()
    if day < now.date():
        return []
    occupied = set(Scheduling.objects.filter(
        barbeiro_id=barber_id, data_agendamento=day,
    ).values_list('horario_agendamento', flat=True))
    slots = {slot for shop in shops for slot in business_slots(shop, day)}
    return [slot.strftime('%H:%M') for slot in sorted(slots - occupied)
            if day > now.date() or slot > now.time().replace(tzinfo=None)]


def available_times_for_shop(shop, day):
    return _available_for_shops([shop], shop.Dono_id, day)


def available_times_for_barber(barber, day):
    return _available_for_shops(barber.barbershop_set.all(), barber.pk, day)


def available_times(service, date):
    """Compatibilidade com chamadas que já selecionaram o serviço."""
    return available_times_for_shop(service.Barbearia, date)
