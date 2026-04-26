FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY mock/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy mock server source and the contracts seed it depends on
COPY mock/main.py ./main.py
COPY contracts/seed/bet-config.json ./contracts/seed/bet-config.json

EXPOSE 3000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
