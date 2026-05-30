#!/usr/bin/env bash
set -euo pipefail

# ─── Stock Intelligence SaaS — Local Dev Bootstrap ─────────
# Run: ./scripts/dev-setup.sh
# This script sets up the entire local development environment.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Stock Intelligence SaaS — Dev Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Copy .env ──────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "📋 Creating .env from .env.example..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "   ✅ .env created — review and update secrets if needed"
else
    echo "📋 .env already exists — skipping"
fi

# ─── 2. Install Dependencies ──────────────────────────────
echo ""
echo "📦 Installing dependencies..."
cd "$PROJECT_DIR"
pnpm install

# ─── 3. Start Infrastructure ──────────────────────────────
echo ""
echo "🐳 Starting Docker infrastructure..."
docker compose -f infra/docker/docker-compose.dev.yml up -d

# ─── 4. Wait for DB ───────────────────────────────────────
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker exec stockintel-postgres pg_isready -U postgres > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "   ❌ PostgreSQL did not become ready in time"
        exit 1
    fi
    sleep 1
done
echo "   ✅ PostgreSQL is ready"

# ─── 5. Wait for Redis ────────────────────────────────────
echo ""
echo "⏳ Waiting for Redis to be ready..."
RETRIES=15
until docker exec stockintel-redis redis-cli ping > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "   ❌ Redis did not become ready in time"
        exit 1
    fi
    sleep 1
done
echo "   ✅ Redis is ready"

# ─── 6. Generate Prisma Client ────────────────────────────
echo ""
echo "🔧 Generating Prisma client..."
pnpm db:generate

# ─── 7. Run Migrations ────────────────────────────────────
echo ""
echo "🗃️  Running database migrations..."
pnpm --filter @stock-intel/db db:migrate:dev -- --name init 2>/dev/null || echo "   Migration already exists or applied"

# ─── 8. Seed Database ─────────────────────────────────────
echo ""
echo "🌱 Seeding database..."
pnpm db:seed

# ─── 9. Done ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Dev setup complete!"
echo ""
echo "Available services:"
echo "  📊 API Server:      http://localhost:3001/api/v1"
echo "  🌐 Web App:         http://localhost:3000"
echo "  🗄️  PostgreSQL:      localhost:5432"
echo "  📮 Redis:           localhost:6379"
echo "  📦 MinIO Console:   http://localhost:9001"
echo "  🔍 Redis Commander: http://localhost:8081"
echo "  📧 Mailpit:         http://localhost:8025"
echo ""
echo "Run 'pnpm dev' to start all services."
