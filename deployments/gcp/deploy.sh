#!/usr/bin/env bash
# Deploy the current branch to this VM: pull latest code, rebuild changed
# images, apply migrations (via the one-shot `migrator` service), and
# restart everything with docker compose.
#
# Intended to run ON the GCP VM itself (invoked locally, or remotely via
# `gcloud compute ssh ... --command="bash $DEPLOY_DIR/deployments/gcp/deploy.sh"`
# from the deploy-gcp.yml GitHub Actions workflow).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/plane_pm_production}"
BRANCH="${DEPLOY_BRANCH:-preview}"

cd "$DEPLOY_DIR"

echo "==> [$(date -u +%FT%TZ)] Deploying branch '$BRANCH' in $DEPLOY_DIR"

echo "==> Fetching latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
COMMIT="$(git rev-parse --short HEAD)"
echo "==> Now at commit $COMMIT"

echo "==> Building images (this only rebuilds what changed)"
docker compose -f docker-compose.yml build

echo "==> Applying migrations + restarting services"
docker compose -f docker-compose.yml up -d

echo "==> Waiting for the api service to report healthy..."
for i in $(seq 1 30); do
    if docker compose -f docker-compose.yml ps api | grep -qi "running\|healthy"; then
        break
    fi
    sleep 2
done

echo "==> Pruning old, now-unused images"
docker image prune -f

echo "==> Recent api logs"
docker compose -f docker-compose.yml logs --tail=30 api

echo "==> Deploy complete: $COMMIT"
