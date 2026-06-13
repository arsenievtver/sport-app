#!/usr/bin/env bash
# Generate production secrets for infra/prod/.env (run once on the server).
set -euo pipefail

SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
POSTGRES_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
S3_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")

cat <<EOF
# Paste into infra/prod/.env (replace change-me values):

SECRET_KEY=${SECRET_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql+asyncpg://sport:${POSTGRES_PASSWORD}@postgres:5432/sport_app
S3_SECRET_KEY=${S3_SECRET_KEY}
EOF
