FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000

# Migrate, then seed, then serve. The seed script is idempotent: it detects an
# already-populated database and exits without touching it, so restarts are safe.
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
