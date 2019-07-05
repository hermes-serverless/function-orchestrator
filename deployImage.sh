set -euo pipefail
docker build --target=production -t hermeshub/conductor:latest .
docker push hermeshub/conductor