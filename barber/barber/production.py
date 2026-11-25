"""Configuração de produção; o desenvolvimento continua em barber.settings."""

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403


def required_env(name):
    value = os.environ.get(name, '').strip()
    if not value:
        raise ImproperlyConfigured(f'Defina a variável {name} para produção.')
    return value


def env_list(name):
    return [value.strip() for value in os.environ.get(name, '').split(',') if value.strip()]


DEBUG = False
SECRET_KEY = required_env('SECRET_KEY')
if len(SECRET_KEY) < 50 or SECRET_KEY.startswith('django-insecure-'):
    raise ImproperlyConfigured('SECRET_KEY deve ter pelo menos 50 caracteres aleatórios.')

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS')
if not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured('ALLOWED_HOSTS deve listar os domínios da aplicação, sem curinga.')

DATABASES = {
    'default': dj_database_url.parse(
        required_env('DATABASE_URL'),
        conn_max_age=60,
        conn_health_checks=True,
    ),
}
if DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
    raise ImproperlyConfigured('Produção requer um DATABASE_URL PostgreSQL persistente.')

CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS')

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
# Ativar apenas atrás de um proxy confiável, como o da hospedagem.
if os.environ.get('TRUST_PROXY_HTTPS') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Permite sondas internas HTTP; os demais caminhos continuam exigindo HTTPS.
SECURE_REDIRECT_EXEMPT = [r'^health/$']

INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'django_extensions']
MIDDLEWARE = [
    MIDDLEWARE[0],
    'whitenoise.middleware.WhiteNoiseMiddleware',
    *MIDDLEWARE[1:],
]
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
WHITENOISE_ROOT = BASE_DIR.parent / 'frontend' / 'dist'
WHITENOISE_INDEX_FILE = True

SIMPLE_JWT = {
    **SIMPLE_JWT,
    'SIGNING_KEY': SECRET_KEY,
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}
