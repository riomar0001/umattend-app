#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Usage: ./deploy.sh [staging|prod]
#
# Builds new images while current containers keep running.
# Only swaps containers after a successful build.
# Rolls back automatically if the health check fails post-swap.
# ---------------------------------------------------------------------------

ENV="${1:-}"
case "$ENV" in
  staging)
    COMPOSE_FILE="docker-compose.staging.yml"
    SERVER_CONTAINER="umattend-server-staging"
    SERVER_PORT="4000"
    CLIENT_IMAGE="umattend-app-client"
    SERVER_IMAGE="umattend-app-server"
    ;;
  production)
    COMPOSE_FILE="docker-compose.production.yml"
    SERVER_CONTAINER="umattend-server-production"
    SERVER_PORT="4000"
    CLIENT_IMAGE="umattend-app-client"
    SERVER_IMAGE="umattend-app-server"
    ;;
  *)
    echo "Usage: $0 [staging|production]"
    exit 1
    ;;
esac

ROLLBACK_SUFFIX="rollback"
HEALTH_RETRIES=15
HEALTH_INTERVAL=8   # seconds between each retry
LOG_FILE="logs/deploy_${ENV}_$(date +%Y%m%d_%H%M%S).log"

mkdir -p logs

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
fail() { log "[FAIL] $*"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Pull latest code
# ---------------------------------------------------------------------------
log "=== Deployment started: $ENV ==="
log "Pulling latest code from $(git rev-parse --abbrev-ref HEAD)..."
git pull origin "$(git rev-parse --abbrev-ref HEAD)" 2>&1 | tee -a "$LOG_FILE"

# ---------------------------------------------------------------------------
# 2. Tag running images as rollback BEFORE building
#    (current containers are not touched at all during this step or the build)
# ---------------------------------------------------------------------------
log "Tagging current images as rollback..."
ROLLBACK_SAVED=false
for IMAGE in "$CLIENT_IMAGE" "$SERVER_IMAGE"; do
  if docker image inspect "$IMAGE" &>/dev/null 2>&1; then
    ROLLBACK_TAG="${IMAGE%:*}:${ROLLBACK_SUFFIX}"
    docker tag "$IMAGE" "$ROLLBACK_TAG"
    log "  $IMAGE  →  $ROLLBACK_TAG"
    ROLLBACK_SAVED=true
  else
    log "  No existing image for $IMAGE, skipping rollback tag"
  fi
done

# ---------------------------------------------------------------------------
# 3. Build new images — current containers keep serving traffic
# ---------------------------------------------------------------------------
log "Building new images (current containers still running)..."
if ! docker compose -f "$COMPOSE_FILE" build --no-cache 2>&1 | tee -a "$LOG_FILE"; then
  fail "Build failed. Current containers were NOT interrupted."
fi
log "Build succeeded."

# ---------------------------------------------------------------------------
# 4. Swap containers (brief downtime here — only after a clean build)
# ---------------------------------------------------------------------------
log "Swapping containers..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"

# ---------------------------------------------------------------------------
# 5. Health check
# ---------------------------------------------------------------------------
log "Waiting for server health check (up to $((HEALTH_RETRIES * HEALTH_INTERVAL))s)..."
HEALTHY=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
  log "  Attempt $i/$HEALTH_RETRIES..."
  if docker exec "$SERVER_CONTAINER" \
      curl -sf "http://localhost:${SERVER_PORT}/api/v1/health" &>/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep "$HEALTH_INTERVAL"
done

# ---------------------------------------------------------------------------
# 6. Rollback if unhealthy
# ---------------------------------------------------------------------------
if [ "$HEALTHY" = false ]; then
  log "[WARN] Health check failed."

  if [ "$ROLLBACK_SAVED" = true ]; then
    log "Rolling back to previous images..."
    for IMAGE in "$CLIENT_IMAGE" "$SERVER_IMAGE"; do
      ROLLBACK_TAG="${IMAGE%:*}:${ROLLBACK_SUFFIX}"
      if docker image inspect "$ROLLBACK_TAG" &>/dev/null 2>&1; then
        docker tag "$ROLLBACK_TAG" "$IMAGE"
        log "  Restored $ROLLBACK_TAG  →  $IMAGE"
      fi
    done
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"
    log "Rollback complete. Verify the service manually."
  else
    log "No rollback images available. Manual intervention required."
  fi

  fail "Deployment failed."
fi

# ---------------------------------------------------------------------------
# 7. Cleanup
# ---------------------------------------------------------------------------
log "Deployment successful. Cleaning up..."
for IMAGE in "$CLIENT_IMAGE" "$SERVER_IMAGE"; do
  ROLLBACK_TAG="${IMAGE%:*}:${ROLLBACK_SUFFIX}"
  if docker image inspect "$ROLLBACK_TAG" &>/dev/null 2>&1; then
    docker rmi "$ROLLBACK_TAG" 2>&1 | tee -a "$LOG_FILE" || true
  fi
done
docker image prune -f 2>&1 | tee -a "$LOG_FILE"

log "=== Deployment complete: $ENV ==="
