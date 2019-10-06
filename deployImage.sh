set -euo pipefail
docker build --target=production -t hermeshub/function-orchestrator:latest .
docker push hermeshub/function-orchestrator