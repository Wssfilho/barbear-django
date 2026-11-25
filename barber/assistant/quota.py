import hashlib
import json
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import Throttled
from .models import AssistantUsage


def reserve(user, data):
    fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()
    now = timezone.now()
    with transaction.atomic():
        # Lock a pre-existing row, including on the user's very first request.
        get_user_model().objects.select_for_update().get(pk=user.pk)
        usage, _ = AssistantUsage.objects.get_or_create(user=user, defaults={'window_started': now})
        recent = {key: stamp for key, stamp in usage.recent.items() if now.timestamp()-stamp < 300}
        if fingerprint in recent:
            raise Throttled(wait=max(1, int(300-(now.timestamp()-recent[fingerprint]))), detail='Esta solicitação já foi enviada. Aguarde antes de repetir.')
        cooldown = settings.AI_COOLDOWN_SECONDS
        if usage.last_started and (now-usage.last_started).total_seconds() < cooldown:
            raise Throttled(wait=cooldown, detail='Aguarde antes de solicitar outra sugestão.')
        if now-usage.window_started >= timedelta(hours=1):
            usage.window_started, usage.count = now, 0
        if usage.count >= settings.AI_REQUESTS_PER_HOUR:
            raise Throttled(wait=max(1, int((usage.window_started+timedelta(hours=1)-now).total_seconds())), detail='Limite de sugestões atingido. Tente novamente mais tarde.')
        usage.count += 1
        usage.last_started = now
        recent[fingerprint] = now.timestamp()
        usage.recent = recent
        usage.save()
