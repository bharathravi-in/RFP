# RFP Application Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying, maintaining, and troubleshooting the RFP Pro application.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Procedures](#deployment-procedures)
3. [Health Checks](#health-checks)
4. [Common Operations](#common-operations)
5. [Troubleshooting](#troubleshooting)
6. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Tools
- Docker & Docker Compose v2+
- Git
- PostgreSQL client (`psql`)
- Redis CLI (`redis-cli`) - optional

### Environment Setup
1. Clone repository
2. Copy `.env.example` to `backend/.env`
3. Configure all required environment variables
4. Ensure GCP service account key (if using GCP storage)

---

## Deployment Procedures

### 1. Development Deployment

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps
```

### 2. Production Deployment

```bash
# Pull latest code
git pull origin main

# Build fresh images
docker compose build --no-cache

# Stop existing services
docker compose down

# Run database migrations
docker compose run --rm backend flask db upgrade

# Start services
docker compose up -d

# Verify deployment
curl http://localhost:5000/health
curl http://localhost:5000/ready
```

### 3. Zero-Downtime Deployment

```bash
# Scale up new containers
docker compose up -d --scale backend=2

# Wait for health checks
sleep 30

# Scale down old containers
docker compose up -d --scale backend=1
```

---

## Health Checks

### Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Liveness | `{"status": "healthy"}` |
| `/ready` | Readiness | `{"status": "ready", "checks": {...}}` |
| `/metrics` | Metrics | Runtime metrics |
| `/api/health` | API health | Service status |

### Automated Health Check

```bash
#!/bin/bash
# health_check.sh

HEALTH_URL="http://localhost:5000/health"
READY_URL="http://localhost:5000/ready"

# Check liveness
if ! curl -sf "$HEALTH_URL" > /dev/null; then
    echo "CRITICAL: Health check failed"
    exit 1
fi

# Check readiness
READY=$(curl -sf "$READY_URL" | jq -r '.status')
if [ "$READY" != "ready" ]; then
    echo "WARNING: Service not ready"
    exit 2
fi

echo "OK: All checks passed"
```

---

## Common Operations

### Database Backup

```bash
# Local backup
./scripts/backup_database.sh

# Backup to GCP
./scripts/backup_database.sh --upload-gcp

# Backup to S3  
./scripts/backup_database.sh --upload-s3
```

### Database Restore

```bash
# From local backup
gunzip -c /tmp/rfp-backups/rfp_backup_TIMESTAMP.sql.gz | \
  docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB

# From GCP
gsutil cp gs://bucket/backups/rfp_backup_TIMESTAMP.sql.gz - | gunzip | \
  docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB
```

### Database Migrations

```bash
# Create new migration
docker compose exec backend flask db migrate -m "Description"

# Apply migrations
docker compose exec backend flask db upgrade

# Rollback last migration
docker compose exec backend flask db downgrade

# Show migration history
docker compose exec backend flask db history
```

### Clear Redis Cache

```bash
docker compose exec redis redis-cli FLUSHALL
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend

# Filter errors
docker compose logs backend 2>&1 | grep -i error
```

---

## Troubleshooting

### Service Won't Start

1. **Check logs**
   ```bash
   docker compose logs backend --tail=50
   ```

2. **Check configuration**
   ```bash
   docker compose exec backend python -c "from app.utils.config_validator import validate_config; print(validate_config())"
   ```

3. **Verify database connection**
   ```bash
   docker compose exec backend python -c "from app import db; db.session.execute('SELECT 1')"
   ```

### High Memory Usage

1. Check container stats:
   ```bash
   docker stats
   ```

2. Restart with memory limits:
   ```yaml
   # docker-compose.yml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 1G
   ```

### Database Connection Issues

1. **Check PostgreSQL is running**
   ```bash
   docker compose ps db
   ```

2. **Test connection**
   ```bash
   docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1"
   ```

3. **Check connection pool**
   ```bash
   docker compose exec db psql -U $POSTGRES_USER -c "SELECT * FROM pg_stat_activity WHERE datname='$POSTGRES_DB'"
   ```

### Redis Connection Issues

```bash
# Test connection
docker compose exec redis redis-cli ping

# Check memory
docker compose exec redis redis-cli info memory
```

### LLM/AI Errors

1. **Check API keys**
   ```bash
   docker compose exec backend python -c "import os; print('OPENAI:', bool(os.getenv('OPENAI_API_KEY'))); print('GEMINI:', bool(os.getenv('GEMINI_API_KEY')))"
   ```

2. **Test LLM connection**
   ```bash
   docker compose exec backend python -c "from app.services.llm_service_helper import get_llm_provider; p=get_llm_provider(1); print(p.test())"
   ```

---

## Rollback Procedures

### Application Rollback

```bash
# Stop current version
docker compose down

# Checkout previous version
git checkout tags/v1.2.3

# Rebuild and start
docker compose build
docker compose up -d
```

### Database Rollback

```bash
# Rollback last migration
docker compose exec backend flask db downgrade

# Rollback to specific revision
docker compose exec backend flask db downgrade abc123
```

### Full Rollback (with backup restore)

```bash
# Stop services
docker compose down

# Restore database from backup
gunzip -c /path/to/backup.sql.gz | docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB

# Checkout previous code version
git checkout tags/v1.2.3

# Start services
docker compose up -d
```

---

## Monitoring Commands

### Quick Status Check

```bash
echo "=== Docker Status ===" && docker compose ps
echo "=== Health Check ===" && curl -s localhost:5000/health | jq
echo "=== Ready Check ===" && curl -s localhost:5000/ready | jq
echo "=== Metrics ===" && curl -s localhost:5000/metrics | jq
```

### Performance Check

```bash
echo "=== Resource Usage ===" && docker stats --no-stream
echo "=== DB Connections ===" && docker compose exec db psql -U $POSTGRES_USER -c "SELECT count(*) FROM pg_stat_activity"
echo "=== Redis Memory ===" && docker compose exec redis redis-cli info memory | grep used_memory_human
```

---

*Last updated: 2025-12-28*
