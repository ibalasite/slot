# Thunder Blessing Slot Game — Mock API Server

FastAPI mock server that implements all three game API endpoints with realistic
simulated responses. Intended for frontend/client developers who do not have
access to the real backend.

---

## Running the server

### Option A — uvicorn directly (Python 3.11+)

```bash
# From the project root
pip install -r mock/requirements.txt
uvicorn mock.main:app --host 0.0.0.0 --port 3000 --reload
```

Or from inside the `mock/` directory:

```bash
cd mock
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3000 --reload
```

The API is available at `http://localhost:3000`.
Interactive docs (Swagger UI): `http://localhost:3000/docs`

### Option B — Docker

Build from the project root (so the Dockerfile can reach both `mock/` and
`contracts/`):

```bash
docker build -f mock/Dockerfile -t thunder-blessing-mock .
docker run -p 3000:3000 thunder-blessing-mock
```

---

## Authentication

All `/v1/*` endpoints require a Bearer token in the `Authorization` header.
The mock accepts **any non-empty string** as a valid token. The token value
is used as a stable player identifier (so the same token always maps to the
same in-memory balance).

```
Authorization: Bearer test-player-1
```

Use any fixed string during development — player balance starts at **1000.00**
per unique token value.

---

## Example curl commands

### GET /v1/config — retrieve bet configuration

```bash
curl -s http://localhost:3000/v1/config \
  -H "Authorization: Bearer test-player-1" | python3 -m json.tool
```

Filter to a single currency:

```bash
curl -s "http://localhost:3000/v1/config?currency=USD" \
  -H "Authorization: Bearer test-player-1" | python3 -m json.tool
```

---

### POST /v1/spin — normal spin (USD, betLevel 5)

```bash
curl -s -X POST http://localhost:3000/v1/spin \
  -H "Authorization: Bearer test-player-1" \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
    "sessionId": null,
    "betLevel": 5,
    "currency": "USD",
    "extraBet": false,
    "buyFeature": false
  }' | python3 -m json.tool
```

---

### POST /v1/spin — Extra Bet spin

```bash
curl -s -X POST http://localhost:3000/v1/spin \
  -H "Authorization: Bearer test-player-1" \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
    "sessionId": null,
    "betLevel": 5,
    "currency": "USD",
    "extraBet": true,
    "buyFeature": false
  }' | python3 -m json.tool
```

Cost = baseBet × 3 = USD 1.25 × 3 = USD 3.75 (betLevel 5).

---

### POST /v1/spin — Buy Feature (guaranteed FG trigger)

```bash
curl -s -X POST http://localhost:3000/v1/spin \
  -H "Authorization: Bearer test-player-1" \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
    "sessionId": null,
    "betLevel": 5,
    "currency": "USD",
    "extraBet": false,
    "buyFeature": true
  }' | python3 -m json.tool
```

Cost = baseBet × 100 = USD 125.00 (betLevel 5).
`fgTriggered` is always `true`. All FG rounds use HEADS to advance the
multiplier ladder fully (all 5 rounds are forced to complete).

---

### GET /v1/session/{sessionId} — resume an in-progress FG session

Copy the `sessionId` from a spin response and query it:

```bash
SESSION_ID="sess-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

curl -s "http://localhost:3000/v1/session/${SESSION_ID}" \
  -H "Authorization: Bearer test-player-1" | python3 -m json.tool
```

Returns `SESSION_NOT_FOUND` (404) if the session expired (1800s TTL) or the
session ID was never created.

---

## How to reliably trigger FG

- **Buy Feature spin**: set `"buyFeature": true` — FG triggers on every spin.
  All 5 FG rounds complete (forced HEADS), reaching the maximum multiplier (×77).
- **Normal spin**: approximately 5% of normal spins trigger FG naturally.
  Run several spins until `fgTriggered: true` appears in the response.

---

## Behavior notes

| Behavior | Detail |
|---|---|
| Balance | Starts at 1000.00 per unique Bearer token; tracked in-memory |
| Win probability | ~80% of normal spins produce a non-zero `totalWin` |
| Thunder Blessing | ~20% of normal spins; requires `lightningMarks.count >= 1` |
| FG trigger | ~5% of normal spins; 100% when `buyFeature: true` |
| FG multipliers | Advances through `[3, 7, 17, 27, 77]` on HEADS |
| Session TTL | 1800s; checked in-memory (no Redis required) |
| Rate limit | 5 requests/second per Bearer token (sliding window) |
| 401 | Missing or blank `Authorization` header |
| 429 | More than 5 req/s from the same token |
