FROM node:22-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=barber.production
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY barber/ ./barber/
COPY --from=frontend /frontend/dist ./frontend/dist/
# Valores exclusivos do build: collectstatic não abre conexão com o banco.
RUN SECRET_KEY=build-only-placeholder-key-not-used-at-runtime-000000000000000000 \
    ALLOWED_HOSTS=build.invalid \
    DATABASE_URL=postgresql://unused:unused@localhost/unused \
    python barber/manage.py collectstatic --noinput
COPY deploy/start.sh ./deploy/start.sh
RUN useradd --create-home appuser && chmod +x deploy/start.sh
USER appuser
EXPOSE 8000
CMD ["sh", "deploy/start.sh"]
