# Render Deployment Guide - ML Service

## Problem
Render ran out of memory (>8GB) when building the Docker image because `dlib` (required by `face-recognition`) compiles from source and is extremely memory-intensive.

## Solution
Build the Docker image locally (where you have enough RAM) and push it to Docker Hub, then configure Render to deploy the prebuilt image.

---

## Steps

### 1. Push Image to Docker Hub

#### Option A: Using the script (recommended)

```bash
# From project root directory
cd /Users/krishna/Project

# Set your Docker Hub username
export DOCKERHUB_USER=your_dockerhub_username

# Make script executable and run it
chmod +x ml/deploy-to-dockerhub.sh
./ml/deploy-to-dockerhub.sh
```

#### Option B: Manual commands

```bash
# From project root
cd /Users/krishna/Project

# Build the image (already done, but you can rebuild)
docker build -t attendance-ml-api:local -f ml/Dockerfile ml

# Tag for Docker Hub
docker tag attendance-ml-api:local YOUR_DOCKERHUB_USERNAME/attendance-ml-api:latest

# Login to Docker Hub
docker login

# Push to Docker Hub
docker push YOUR_DOCKERHUB_USERNAME/attendance-ml-api:latest
```

### 2. Configure Render to Use Docker Hub Image

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your ML service (or create a new Web Service)
3. Click "Settings" or during creation, choose:
   - **Deploy an existing image from a registry**
4. Enter image details:
   - **Image URL**: `YOUR_DOCKERHUB_USERNAME/attendance-ml-api:latest`
   - **Registry**: Docker Hub (public)
5. Set environment:
   - **Port**: `9000`
6. Click "Deploy" or "Save Changes"

### 3. Verify Deployment

Once deployed, Render will:
- Pull the prebuilt image from Docker Hub (fast, ~30 seconds)
- Start the container (no compilation needed)
- Your service should be live within 1-2 minutes

---

## Alternative: Use Conda-based Dockerfile (if needed)

If you can't use Docker Hub, you can modify the Dockerfile to use Conda and install prebuilt `dlib` from `conda-forge`. This reduces memory usage during build but may still hit limits on Render's free tier.

Let me know if you need the Conda-based Dockerfile.

---

## Troubleshooting

### Docker Hub Push Fails
- Make sure you're logged in: `docker login`
- Verify your username is correct
- Check Docker Hub repository exists or create it

### Render Can't Pull Image
- Make sure the Docker Hub repository is **public**
- Verify the image URL is exactly: `username/image-name:tag`

### Service Won't Start
- Check Render logs for errors
- Verify port 9000 is correct
- Ensure all environment variables are set (MongoDB connection, etc.)
