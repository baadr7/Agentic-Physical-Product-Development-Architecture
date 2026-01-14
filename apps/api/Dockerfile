# syntax=docker/dockerfile:1

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/apps/api

# System deps (kept minimal). Add build-essential only if you compile wheels.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps first for better layer caching
COPY apps/api/requirements.txt /app/apps/api/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the API app
COPY apps/api /app/apps/api

# Render/Fly typically provide $PORT. Default for local docker runs.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-lc", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
