#!/usr/bin/env python3
"""Hospedagem local: python3 deploy/host.py start|status|stop|backup."""

import argparse
from datetime import datetime
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / '.env.host'
COMPOSE = ['docker', 'compose', '--env-file', str(ENV_FILE), '-f', str(ROOT / 'compose.host.yaml')]


def compose(*args, **kwargs):
    return subprocess.run([*COMPOSE, *args], cwd=ROOT, check=True, **kwargs)


def read_env():
    return dict(line.split('=', 1) for line in ENV_FILE.read_text().splitlines()
                if line and not line.startswith('#'))


def write_env(values):
    temporary = ENV_FILE.with_name('.env.host.tmp')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        stream.write(''.join(f'{key}={value}\n' for key, value in values.items()))
    temporary.replace(ENV_FILE)
    ENV_FILE.chmod(0o600)


def prepare_env():
    if not ENV_FILE.exists():
        write_env({
            'POSTGRES_PASSWORD': secrets.token_urlsafe(32),
            'SECRET_KEY': secrets.token_urlsafe(64),
            'PUBLIC_HOST': 'localhost',
            'ADMIN_USERNAME': 'admin',
            'ADMIN_PASSWORD': secrets.token_urlsafe(24),
        })
        print('Configuração privada criada em .env.host.', flush=True)


def start():
    prepare_env()
    # docker build evita a normalização de caminhos Unicode feita pelo Compose Bake.
    subprocess.run(['docker', 'build', '-t', 'barbear-host:local', '.'], cwd=ROOT, check=True)
    compose('up', '-d', '--no-build', '--wait', 'db', 'web')
    values = read_env()
    # A senha vai por stdin, sem aparecer no comando ou nos logs.
    bootstrap = (
        'import sys; sys.path.insert(0,"/app/barber"); import django; django.setup(); '
        'from django.contrib.auth import get_user_model; '
        'U=get_user_model(); username=sys.stdin.readline().strip(); '
        'password=sys.stdin.readline().strip(); '
        'U.objects.filter(username=username).exists() or '
        'U.objects.create_superuser(username=username,password=password); '
        'print("Administrador disponível; credenciais no arquivo .env.host.")'
    )
    compose('exec', '-T', 'web', 'python', '-c', bootstrap,
            input=values['ADMIN_USERNAME'] + '\n' + values['ADMIN_PASSWORD'] + '\n', text=True)
    compose('--profile', 'public', 'up', '-d', 'tunnel')
    deadline = time.monotonic() + 50
    while time.monotonic() < deadline:
        result = compose('logs', '--no-color', '--tail', '100', 'tunnel', capture_output=True, text=True)
        hosts = re.findall(r'https://([a-z0-9-]+\.trycloudflare\.com)', result.stdout + result.stderr)
        if hosts:
            host = hosts[-1]
            if host != values['PUBLIC_HOST']:
                values['PUBLIC_HOST'] = host
                write_env(values)
                compose('up', '-d', '--wait', 'web')
            print(f'\nSistema: https://{host}\nAdministração: https://{host}/admin/')
            print('O endereço é temporário. Mantenha a máquina, o Docker e a internet ativos.')
            return
        time.sleep(2)
    raise RuntimeError('O túnel não gerou um endereço. Confira: docker compose --env-file .env.host -f compose.host.yaml logs tunnel')


def backup():
    directory = ROOT / 'backups'
    directory.mkdir(mode=0o700, exist_ok=True)
    path = directory / ('barbear-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.dump')
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        compose('exec', '-T', 'db', 'pg_dump', '-U', 'barbear', '-Fc', 'barbear', stdout=stream)
    print(f'Backup salvo: {path}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'status', 'stop', 'backup'])
    action = parser.parse_args().action
    if action == 'start':
        start()
        return
    if not ENV_FILE.exists():
        raise RuntimeError('Execute python3 deploy/host.py start primeiro.')
    if action == 'stop':
        compose('--profile', 'public', 'stop')
    elif action == 'status':
        compose('--profile', 'public', 'ps', '-a')
        host = read_env().get('PUBLIC_HOST', 'localhost')
        if host != 'localhost':
            print(f'Último endereço configurado: https://{host}')
    elif action == 'backup':
        backup()


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Não foi possível concluir: {error}', file=sys.stderr)
        sys.exit(1)
