#!/bin/sh
set -e

echo "Ожидание PostgreSQL..."
python - <<'PY'
import os, time, psycopg
for i in range(60):
    try:
        psycopg.connect(
            host=os.environ.get("POSTGRES_HOST", "db"), port=os.environ.get("POSTGRES_PORT", "5432"),
            user=os.environ.get("POSTGRES_USER", "postgres"), password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
            dbname=os.environ.get("POSTGRES_DB", "developer"),
        ).close()
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("PostgreSQL недоступен")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput -v0

if [ "${SEED_DEMO:-1}" = "1" ]; then
  python manage.py seed_demo
fi

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3} --access-logfile -
