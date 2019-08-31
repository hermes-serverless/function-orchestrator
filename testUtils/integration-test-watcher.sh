#! /bin/bash
set -euo pipefail

display_info() {
  printf "Usage ./start-watcher-test-env.sh [OPT]\nOptions are:\n"
  printf "  -b: build docker-compose\n"
  printf "  -w: Show this message\n"
  printf "  -h: Show this message\n"
  exit 0
}

BUILD=false
WATCH=false
while getopts "wbh" OPT; do
  case "$OPT" in
    "b") BUILD=true;;
    "w") WATCH=true;;
    "h") display_info;;
    "?") display_info;;
  esac 
done

docker network create hermes-test || true

SCRIPT=$(python -c "import os; print(os.path.realpath('$0'))")
SCRIPTPATH=`dirname $SCRIPT`

DOCKER_COMPOSE_OPTS="-p watcher-test -f $SCRIPTPATH/watcher-test.yml"

docker-compose $DOCKER_COMPOSE_OPTS down -v

if [ "$BUILD" == "true" ]; then
  docker-compose $DOCKER_COMPOSE_OPTS build
fi

YARN_COMMAND="yarn inside-container/integration-test-watcher"
if [ "$WATCH" == "true" ]; then
  YARN_COMMAND="yarn inside-container/watch-integration-test-watcher"
fi

docker-compose $DOCKER_COMPOSE_OPTS run --rm conductor $YARN_COMMAND

printf "\n\n"
docker container ls
