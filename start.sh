#!/usr/bin/env bash
# ============================================================================
#  «Новый Горизонт» — запуск проекта одной командой
#
#    ./start.sh           — автоматически: Docker, если он установлен, иначе локально
#    ./start.sh docker    — только через Docker Compose
#    ./start.sh local     — без Docker (Python + Node + PostgreSQL на компьютере)
#    ./start.sh stop      — остановить Docker-контейнеры
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; N=$'\033[0m'
say()  { echo "${C}▸${N} $*"; }
ok()   { echo "${G}✔${N} $*"; }
warn() { echo "${Y}!${N} $*"; }
die()  { echo "${R}✖ $*${N}"; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }
open_url() { if has open; then open "$1"; elif has xdg-open; then xdg-open "$1" >/dev/null 2>&1 || true; fi; }

wait_http() { # url, секунд
  for _ in $(seq 1 "$2"); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

# .env нужен для Docker-режима; создаём из шаблона, если его нет
ensure_env() {
  if [ ! -f .env ]; then
    cp .env.example .env
    KEY="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 50 || true)"
    sed -i.bak "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=${KEY}|" .env && rm -f .env.bak
    ok "Создан файл .env"
  fi
}

print_accounts() {
  cat <<EOF

${B}Демо-аккаунты${N} (пароль → код из письма):
  Администратор  admin@novyi-gorizont.local    Admin12345!
  Менеджер       manager@novyi-gorizont.local  Manager12345!
  Клиент         client@novyi-gorizont.local   Client12345!
EOF
}

# ---------------------------------------------------------------------------
docker_ready() { has docker && docker info >/dev/null 2>&1; }

start_docker_daemon() {
  if has docker && ! docker info >/dev/null 2>&1; then
    if [ -d "/Applications/Docker.app" ]; then
      say "Запускаю Docker Desktop…"
      open -a Docker || true
      for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && return 0; sleep 2; done
    fi
    return 1
  fi
}

run_docker() {
  start_docker_daemon || true
  docker_ready || die "Docker не запущен. Откройте Docker Desktop и повторите, либо запустите: ./start.sh local"
  ensure_env
  say "Собираю и запускаю контейнеры (первый запуск — 3–5 минут)…"
  docker compose up --build -d
  say "Жду, пока сайт станет доступен…"
  if wait_http "http://localhost:3000/api/company/" 240; then
    ok "Готово!"
  else
    warn "Сайт пока не отвечает. Логи: docker compose logs -f backend"
  fi
  cat <<EOF

${B}Сайт:${N}          http://localhost:3000
${B}Почта (коды):${N}  http://localhost:8025
${B}Django admin:${N}  http://localhost:3000/django-admin/
EOF
  print_accounts
  echo
  echo "Остановить: ${B}./start.sh stop${N}   Логи: ${B}docker compose logs -f${N}"
  open_url "http://localhost:3000"
  open_url "http://localhost:8025"
}

# ---------------------------------------------------------------------------
find_python() {
  for p in python3.13 python3.12 python3.11 python3.10 python3; do
    if has "$p" && "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      echo "$p"; return 0
    fi
  done
  return 1
}

node_ok() {
  has node || return 1
  node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)'
}

pg_bin_path() {
  # Postgres.app и Homebrew кладут бинарники не в PATH по умолчанию
  for d in /Applications/Postgres.app/Contents/Versions/latest/bin /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin /opt/homebrew/bin /usr/local/bin /usr/lib/postgresql/16/bin; do
    [ -x "$d/pg_isready" ] && { echo "$d"; return 0; }
  done
  return 1
}

run_local() {
  say "Режим без Docker: проверяю Python, Node.js и PostgreSQL…"

  PY="$(find_python || true)"
  if [ -z "$PY" ] && has brew; then say "Устанавливаю Python 3.12 через Homebrew…"; brew install python@3.12; PY="$(find_python || true)"; fi
  [ -n "$PY" ] || die "Нужен Python 3.10+. Установите с https://www.python.org/downloads/ и повторите."
  ok "Python: $($PY --version)"

  if ! node_ok && has brew; then say "Устанавливаю Node.js 22 через Homebrew…"; brew install node@22; export PATH="$(brew --prefix node@22)/bin:$PATH"; fi
  node_ok || die "Нужен Node.js 22 (или 20.19+). Установите с https://nodejs.org и повторите."
  ok "Node.js: $(node --version)"

  PGBIN="$(pg_bin_path || true)"
  if [ -z "$PGBIN" ] && has brew; then
    say "Устанавливаю PostgreSQL 16 через Homebrew…"
    brew install postgresql@16
    PGBIN="$(pg_bin_path || true)"
  fi
  [ -n "$PGBIN" ] || die "Нужен PostgreSQL. Проще всего — Postgres.app: https://postgresapp.com (или установите Docker Desktop)."
  export PATH="$PGBIN:$PATH"

  if ! pg_isready -h localhost -q; then
    if has brew && brew list postgresql@16 >/dev/null 2>&1; then say "Запускаю PostgreSQL…"; brew services start postgresql@16 >/dev/null
    elif [ -d /Applications/Postgres.app ]; then say "Запускаю Postgres.app…"; open -a Postgres || true
    fi
    for _ in $(seq 1 30); do pg_isready -h localhost -q && break; sleep 1; done
  fi
  pg_isready -h localhost -q || die "PostgreSQL не отвечает на localhost:5432. Запустите его и повторите."
  ok "PostgreSQL запущен"

  # Пользователь БД: postgres (Linux/Postgres.app) или имя пользователя macOS (Homebrew)
  export POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB="${POSTGRES_DB:-developer}"
  export POSTGRES_PASSWORD="${LOCAL_POSTGRES_PASSWORD:-postgres}"
  export PGPASSWORD="$POSTGRES_PASSWORD"
  if psql -h localhost -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
    export POSTGRES_USER=postgres
  else
    export POSTGRES_USER="$(whoami)"
    psql -h localhost -U "$POSTGRES_USER" -d postgres -tAc 'select 1' >/dev/null 2>&1 \
      || die "Не удаётся подключиться к PostgreSQL. Задайте пароль пользователя postgres: LOCAL_POSTGRES_PASSWORD=... ./start.sh local"
  fi
  if ! psql -h localhost -U "$POSTGRES_USER" -d postgres -tAc "select 1 from pg_database where datname='$POSTGRES_DB'" | grep -q 1; then
    createdb -h localhost -U "$POSTGRES_USER" "$POSTGRES_DB"
    ok "Создана база данных $POSTGRES_DB"
  fi

  # Бэкенд
  cd "$ROOT/backend"
  if [ ! -x .venv/bin/python ]; then say "Создаю виртуальное окружение Python…"; "$PY" -m venv .venv; fi
  if [ ! -f .venv/.installed ] || [ requirements.txt -nt .venv/.installed ]; then
    say "Устанавливаю зависимости бэкенда…"
    .venv/bin/pip install -q --upgrade pip
    .venv/bin/pip install -q -r requirements.txt
    touch .venv/.installed
  fi
  export DJANGO_DEBUG=1 DJANGO_ALLOWED_HOSTS='*'
  export EMAIL_BACKEND=django.core.mail.backends.filebased.EmailBackend
  export EMAIL_FILE_PATH="$ROOT/backend/sent_emails"
  mkdir -p "$EMAIL_FILE_PATH"
  .venv/bin/python manage.py migrate --noinput -v0
  .venv/bin/python manage.py seed_demo
  ok "База данных готова"

  # Фронтенд
  cd "$ROOT/frontend"
  if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    say "Устанавливаю зависимости фронтенда…"
    npm install --no-audit --no-fund --loglevel=error
    touch node_modules
  fi

  cd "$ROOT/backend"
  : > "$ROOT/backend/server.log"
  .venv/bin/python manage.py runserver 127.0.0.1:8000 >>"$ROOT/backend/server.log" 2>&1 &
  BACK_PID=$!
  # Показываем коды 2FA прямо в этом терминале
  "$ROOT/backend/.venv/bin/python" - "$EMAIL_FILE_PATH" <<'PY' &
import os, re, sys, time
folder, seen = sys.argv[1], set(os.listdir(sys.argv[1]))
while True:
    for f in sorted(os.listdir(folder)):
        if f in seen: continue
        seen.add(f)
        try: text = open(os.path.join(folder, f), encoding="utf-8", errors="ignore").read()
        except OSError: continue
        to = re.search(r"^To: (.+)$", text, re.M)
        for code in dict.fromkeys(re.findall(r"код[^:\n]*: (\d{6})", text)):
            print(f"\n\033[1;42m 📧 Код для {to.group(1) if to else ''}: {code} \033[0m\n", flush=True)
    time.sleep(1)
PY
  MAIL_PID=$!
  trap 'kill $BACK_PID $MAIL_PID 2>/dev/null; echo; ok "Серверы остановлены"; exit 0' INT TERM EXIT
  wait_http "http://127.0.0.1:8000/api/company/" 60 || { tail -30 "$ROOT/backend/server.log"; die "Бэкенд не запустился (лог выше)"; }
  ok "Бэкенд: http://localhost:8000"

  cat <<EOF

${B}Сайт:${N}          http://localhost:5173
${B}Django admin:${N}  http://localhost:5173/django-admin/
${B}Коды 2FA${N} появятся прямо в этом окне (зелёная строка) после ввода пароля.
EOF
  print_accounts
  echo
  echo "Остановить: ${B}Ctrl+C${N}"
  (sleep 3; open_url "http://localhost:5173") &
  cd "$ROOT/frontend"
  npx vite --port 5173 --strictPort
}

# ---------------------------------------------------------------------------
MODE="${1:-auto}"
case "$MODE" in
  stop)   docker compose down; ok "Контейнеры остановлены" ;;
  docker) run_docker ;;
  local)  run_local ;;
  auto)
    if has docker; then run_docker
    else warn "Docker не найден — запускаю без Docker"; run_local
    fi ;;
  *) die "Неизвестный режим: $MODE (используйте: docker | local | stop)" ;;
esac
