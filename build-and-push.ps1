# Script to manually build and push all 6 Docker images to Docker Hub
# Usage: .\build-and-push.ps1 -Username "your_dockerhub_username" -Tag "your_tag"

param (
    [Parameter(Mandatory=$true)]
    [string]$Username,

    [Parameter(Mandatory=$false)]
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

# Log in to Docker Hub if not already logged in
Write-Host "Checking Docker login status..." -ForegroundColor Cyan
docker login

# List of services to build
Write-Host "Starting build for all services..." -ForegroundColor Cyan

# 1. API
Write-Host "Building stock-intel-api..." -ForegroundColor Yellow
docker build -f infra/docker/Dockerfile.api -t "$Username/stock-intel-api:latest" -t "$Username/stock-intel-api:$Tag" .

# 2. Web (Next.js)
Write-Host "Building stock-intel-web..." -ForegroundColor Yellow
docker build -f infra/docker/Dockerfile.web -t "$Username/stock-intel-web:latest" -t "$Username/stock-intel-web:$Tag" .

# 3. Worker Ingestion
Write-Host "Building stock-intel-worker-ingestion..." -ForegroundColor Yellow
docker build --build-arg WORKER=ingestion -f infra/docker/Dockerfile.worker -t "$Username/stock-intel-worker-ingestion:latest" -t "$Username/stock-intel-worker-ingestion:$Tag" .

# 4. Worker Processing
Write-Host "Building stock-intel-worker-processing..." -ForegroundColor Yellow
docker build --build-arg WORKER=processing -f infra/docker/Dockerfile.worker -t "$Username/stock-intel-worker-processing:latest" -t "$Username/stock-intel-worker-processing:$Tag" .

# 5. Worker AI
Write-Host "Building stock-intel-worker-ai..." -ForegroundColor Yellow
docker build --build-arg WORKER=ai -f infra/docker/Dockerfile.worker -t "$Username/stock-intel-worker-ai:latest" -t "$Username/stock-intel-worker-ai:$Tag" .

# 6. Worker Payment
Write-Host "Building stock-intel-worker-payment..." -ForegroundColor Yellow
docker build --build-arg WORKER=payment -f infra/docker/Dockerfile.worker -t "$Username/stock-intel-worker-payment:latest" -t "$Username/stock-intel-worker-payment:$Tag" .

Write-Host "Build complete! Starting push to Docker Hub..." -ForegroundColor Cyan

$services = @("api", "web", "worker-ingestion", "worker-processing", "worker-ai", "worker-payment")

foreach ($service in $services) {
    Write-Host "Pushing $service..." -ForegroundColor Yellow
    docker push "$Username/stock-intel-$service:latest"
    if ($Tag -ne "latest") {
        docker push "$Username/stock-intel-$service:$Tag"
    }
}

Write-Host "Successfully built and pushed all images!" -ForegroundColor Green
