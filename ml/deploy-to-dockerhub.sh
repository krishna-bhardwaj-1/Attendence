#!/bin/bash
# Deploy ML service to Docker Hub to avoid Render memory issues
# Building dlib from source requires >8GB RAM, so we build locally and push to Docker Hub

set -e

# Configuration - UPDATE THESE VALUES
DOCKERHUB_USER="${DOCKERHUB_USER:-YOUR_DOCKERHUB_USERNAME}"
IMAGE_NAME="attendance-ml-api"
TAG="${TAG:-latest}"

echo "========================================="
echo "Building ML Docker image locally..."
echo "========================================="

# Build the image (from project root, targeting ml/ directory)
docker build -t ${IMAGE_NAME}:local -f ml/Dockerfile ml

echo ""
echo "========================================="
echo "Tagging image for Docker Hub..."
echo "========================================="

# Tag for Docker Hub
docker tag ${IMAGE_NAME}:local ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}

echo ""
echo "========================================="
echo "Pushing to Docker Hub..."
echo "========================================="
echo "Make sure you're logged in: docker login"
echo ""

# Push to Docker Hub
docker push ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}

echo ""
echo "========================================="
echo "✅ SUCCESS!"
echo "========================================="
echo ""
echo "Image pushed to: ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"
echo ""
echo "Next steps for Render:"
echo "1. Go to your Render dashboard"
echo "2. Create a new Web Service (or edit existing)"
echo "3. Choose 'Deploy an existing image from a registry'"
echo "4. Enter image URL: ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"
echo "5. Set the port to 9000"
echo "6. Deploy!"
echo ""
