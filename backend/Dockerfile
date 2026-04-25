# =============================================================================
# FinWatch Zambia — Backend Dockerfile (Optimised for Render)
# =============================================================================

FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /backend

# Install system dependencies
# gcc and python3-dev are needed for building some python packages
# libpq-dev is required for psycopg2 (PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    python3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Ensure model artifacts exist (or at least the directory does)
RUN mkdir -p ml/artifacts

# Expose port
EXPOSE 8000

# Start command
# We use a single worker because of Render's 512MB RAM limit on free tier.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
