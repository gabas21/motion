# Stage 1: Build & install dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies needed for compiling certain packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install wheels in a local directory
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Final lightweight runner
FROM python:3.11-slim AS runner

WORKDIR /app

# Create a non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -r -u 1001 -g appgroup appuser

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local
COPY --from=builder /app /app

# Copy service code
COPY . .

# Adjust permissions
RUN chown -R appuser:appgroup /app

USER appuser

# Add user bin to PATH (for uvicorn, etc.)
ENV PATH=/home/appuser/.local/bin:$PATH

EXPOSE 8000

# Command to run FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
