# Flask ML API Dockerfile using Mambaforge (Conda) to install prebuilt dlib
FROM condaforge/mambaforge:23.1.0-0

# Create and set working directory
WORKDIR /app

# Copy conda environment file then create environment with mamba
COPY environment.yml /app/environment.yml
RUN mamba env create -f /app/environment.yml && \
    mamba clean --all --yes

# Ensure conda environment is available for subsequent RUN/CMD
SHELL ["/bin/bash", "-lc"]
ENV CONDA_DEFAULT_ENV=attendance-ml
ENV PATH=/opt/conda/envs/attendance-ml/bin:$PATH

# Copy application files
COPY . /app

# Expose port
EXPOSE 9000

# Run using the conda environment's Python
CMD ["gunicorn", "--bind", "0.0.0.0:9000", "--workers", "2", "--timeout", "120", "--worker-class", "sync", "app:app"]
