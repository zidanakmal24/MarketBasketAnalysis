FROM python:3.11-slim

# Set working directory di dalam container
WORKDIR /app

# Copy requirement terlebih dahulu agar Docker bisa melakukan caching
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh file project (termasuk folder backend, frontend, dan model)
COPY . .

# Set environment variable untuk port default Cloud Run
ENV PORT=8080

# Jalankan Uvicorn server, mengarah ke file app.py yang ada di dalam folder backend
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT}"]
