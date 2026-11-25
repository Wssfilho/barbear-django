#!/bin/sh
set -eu

python barber/manage.py check --deploy --fail-level WARNING
python barber/manage.py migrate --noinput
exec gunicorn --chdir barber barber.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --access-logfile - --error-logfile -
