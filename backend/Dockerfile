FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py database.py models.py schemas.py scraper.py ./

# SQLite file is created in the working directory, so keep it on a volume.
WORKDIR /data
VOLUME /data

EXPOSE 8000
CMD ["uvicorn", "main:app", "--app-dir", "/app", "--host", "0.0.0.0", "--port", "8000"]
