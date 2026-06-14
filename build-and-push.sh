#!/bin/bash
# Script to manually build and push all 6 Docker images to Docker Hub
# Usage: ./build-and-push.sh your_dockerhub_username [your_tag]

set -e

USERNAME=$1
TAG=${2:-latest}

if [ -z "$USERNAME" ]; then
  echo "Usage: ./build-and-push.sh <your_dockerhub_username> [your_tag]"
  exit 1
fi

# Log in to Docker Hub
echo -e "\e[36mChecking Docker login status...\e[0m"
docker login

echo -e "\e[36mStarting build for all services...\e[0m"

# 1. API
echo -e "\e[33mBuilding stock-intel-api...\e[0m"
docker build -f infra/docker/Dockerfile.api -t "$USERNAME/stock-intel-api:latest" -t "$USERNAME/stock-intel-api:$TAG" .

# 2. Web (Next.js)
echo -e "\e[33mBuilding stock-intel-web...\e[0m"
docker build -f infra/docker/Dockerfile.web -t "$USERNAME/stock-intel-web:latest" -t "$USERNAME/stock-intel-web:$TAG" .

# 3. Worker Ingestion
echo -e "\e[33mBuilding stock-intel-worker-ingestion...\e[0m"
docker build --build-arg WORKER=ingestion -f infra/docker/Dockerfile.worker -t "$USERNAME/stock-intel-worker-ingestion:latest" -t "$USERNAME/stock-intel-worker-ingestion:$TAG" .

# 4. Worker Processing
echo -e "\e[33mBuilding stock-intel-worker-processing...\e[0m"
docker build --build-arg WORKER=processing -f infra/docker/Dockerfile.worker -t "$USERNAME/stock-intel-worker-processing:latest" -t "$USERNAME/stock-intel-worker-processing:$TAG" .

# 5. Worker AI
echo -e "\e[33mBuilding stock-intel-worker-ai...\e[0m"
docker build --build-arg WORKER=ai -f infra/docker/Dockerfile.worker -t "$USERNAME/stock-intel-worker-ai:latest" -t "$USERNAME/stock-intel-worker-ai:$TAG" .

# 6. Worker Payment
echo -e "\e[33mBuilding stock-intel-worker-payment...\e[0m"
docker build --build-arg WORKER=payment -f infra/docker/Dockerfile.worker -t "$USERNAME/stock-intel-worker-payment:latest" -t "$USERNAME/stock-intel-worker-payment:$TAG" .

echo -e "\e[36mBuild complete! Starting push to Docker Hub...\e[0m"

services=("api" "web" "worker-ingestion" "worker-processing" "worker-ai" "worker-payment")

for service in "${services[@]}"; do
  echo -e "\e[33mPushing $service...\e[0m"
  docker push "$USERNAME/stock-intel-$service:latest"
  if [ "$TAG" != "latest" ]; then
    docker push "$USERNAME/stock-intel-$service:$TAG"
  fi
done

echo -e "\e[32mSuccessfully built and pushed all images!\e[0m"
