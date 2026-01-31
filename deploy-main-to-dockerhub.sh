#!/bin/bash
# Build and push main Node.js app to Docker Hub
set -e

DOCKERHUB_USER="${DOCKERHUB_USER:-krishna9283}"
IMAGE_NAME="attendance-app"
TAG="${TAG:-latest}"

echo "Building main app image..."
docker build -t ${IMAGE_NAME}:local .

echo "Tagging image for Docker Hub..."
docker tag ${IMAGE_NAME}:local ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}

echo "Pushing to Docker Hub..."
echo "Make sure you're logged in: docker login"
docker push ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}

echo "Done: ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"
