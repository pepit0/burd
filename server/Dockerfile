FROM python:3.11-slim

WORKDIR /app

# Core deps (mock mode). For live models, also COPY + install requirements-ml.txt.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV INFERENCE_MOCK=true
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
