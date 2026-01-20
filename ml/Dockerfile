# Flask ML API Dockerfile
# Use slim Python base
FROM python:3.10-slim

# Install required system packages to build dlib/face-recognition
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    pkg-config \
    git \
    ca-certificates \
    python3-dev \
    libboost-all-dev \
    libblas-dev \
    liblapack-dev \
    libgl1 \
    libglib2.0-0 \
    libx11-6 \
    libxext6 \
    libsm6 \
    libxrender1 \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Speed up builds a bit and ensure wheel tooling is present
ENV PIP_NO_CACHE_DIR=off
RUN pip install --upgrade pip setuptools wheel

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port
EXPOSE 9000

CMD ["gunicorn", "--bind", "0.0.0.0:9000", "--workers", "2", "--timeout", "120", "--worker-class", "sync", "app:app"]
