#!/bin/bash

set -euo pipefail

display_info() {
  printf "Usage ./buildHermesFunctionTestImage.sh [OPT] FN_PATH\nOptions are:\n"
  printf "  -h: Show this message\n"
  printf "  -d: Development node environment\n"
  exit 0
}

NODE_ENV='production'
while getopts "dh" OPT; do
  case "$OPT" in
    "d") NODE_ENV='development';;
    "h") display_info;;
    "?") display_info;;
  esac 
done


shift $((OPTIND - 1)) 
if [  $# -le 0 ] 
then 
  display_info
  exit 1
fi 

HERMES_CONFIG_PATH="$1/hermes.config.json"
FN_NAME=$( cat $HERMES_CONFIG_PATH | python -c "import json,sys;obj=json.load(sys.stdin);print obj['functionName'];")
FN_VERSION=$( cat $HERMES_CONFIG_PATH | python -c "import json,sys;obj=json.load(sys.stdin);print obj['functionVersion'];")
LANGUAGE=$( cat $HERMES_CONFIG_PATH | python -c "import json,sys;obj=json.load(sys.stdin);print obj['language'];")
FN_BUILDER_DOCKERFILE=$( curl https://raw.githubusercontent.com/hermes-tcc/project-building-base-images/master/$LANGUAGE.Dockerfile )

echo "======== BUILDING FUNCTION ========"
echo "$FN_BUILDER_DOCKERFILE" | \
  docker build  -t function-orchestrator-test/build-$FN_NAME-$FN_VERSION \
                -f - \
                $1
echo ""
echo ""

echo "======== BUILDING WATCHER ========"
docker build  -t function-orchestrator-test/watcher-$FN_NAME-$FN_VERSION:latest \
              --target="$NODE_ENV" \
              --build-arg FN_IMAGE=function-orchestrator-test/build-$FN_NAME-$FN_VERSION \
              --build-arg FN_LANGUAGE=$LANGUAGE \
              github.com/hermes-tcc/function-watcher
echo ""
echo ""

docker images function-orchestrator-test/watcher-$FN_NAME-$FN_VERSION:latest
echo ""
echo ""

docker history function-orchestrator-test/watcher-$FN_NAME-$FN_VERSION:latest
echo ""
echo ""