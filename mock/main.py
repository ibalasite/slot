"""
Thunder Blessing Slot Game — FastAPI Mock Server
Implements POST /v1/spin, GET /v1/session/{sessionId}, GET /v1/config
with realistic response simulation and in-memory state.
"""

from __future__ import annotations

import json
import random
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ─── Load bet config seed ────────────────────────────────────────────────────

_BET_CONFIG_PATH = Path(__file__).parent.parent / "contracts" / "seed" / "bet-config.json"
with _BET_CONFIG_PATH.open() as _f:
    BET_CONFIG: dict[str, Any] = json.load(_f)

# Indexed lookup: currency -> level -> {baseBet, extraBetCost, buyFeatureCost}
_BET_INDEX: dict[str, dict[int, dict[str, float]]] = {}
for _currency, _range in BET_CONFIG["betRange"].items():
    _BET_INDEX[_currency] = {}
    for _lvl in _range["levels"]:
        _BET_INDEX[_currency][_lvl["level"]] = {
            "baseBet": _lvl["baseBet"],
            "extraBetCost": _lvl["extraBetCost"],
            "buyFeatureCost": _lvl["buyFeatureCost"],
        }

# ─── Constants ───────────────────────────────────────────────────────────────

ENGINE_VERSION = "1.0.0"
FG_MULTIPLIER_SEQUENCE = [3, 7, 17, 27, 77]
FG_BONUS_MULTIPLIERS = [1, 5, 20, 100]
SYMBOL_POOL = ["W", "SC", "P1", "P2", "P3", "P4", "L1", "L2", "L3", "L4"]
PREMIUM_SYMBOLS = ["P1", "P2", "P3", "P4"]
NON_WILD_SYMBOLS = ["SC", "P1", "P2", "P3", "P4", "L1", "L2", "L3", "L4"]
WINNING_SYMBOLS = ["P1", "P2", "P3", "P4", "L1", "L2", "L3", "L4"]

# ─── In-memory state ─────────────────────────────────────────────────────────

# player_id -> balance
_balances: dict[str, float] = defaultdict(lambda: 1000.0)

# session_id -> session dict
_sessions: dict[str, dict[str, Any]] = {}

# player_id -> deque of request timestamps (sliding window for rate limiting)
_rate_windows: dict[str, deque[float]] = defaultdict(deque)

RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 1.0  # seconds

# ─── Helpers ─────────────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
           f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def _new_request_id() -> str:
    return str(uuid.uuid4())


def _success(data: Any, request_id: str) -> dict[str, Any]:
    return {
        "success": True,
        "requestId": request_id,
        "timestamp": _now_iso(),
        "data": data,
    }


def _error(code: str, message: str, request_id: str, status: int,
           retry_after: Optional[int] = None) -> JSONResponse:
    body: dict[str, Any] = {
        "success": False,
        "code": code,
        "message": message,
        "requestId": request_id,
        "timestamp": _now_iso(),
    }
    if retry_after is not None:
        body["retryAfter"] = retry_after
    return JSONResponse(status_code=status, content=body)


def _check_auth(authorization: Optional[str], request_id: str) -> Optional[JSONResponse]:
    """Return 401 JSONResponse if Bearer token is absent."""
    if not authorization or not authorization.startswith("Bearer "):
        return _error("UNAUTHORIZED", "JWT is missing, malformed, or expired",
                      request_id, 401)
    return None


def _check_rate_limit(player_id: str, request_id: str) -> Optional[JSONResponse]:
    """Sliding-window 5 req/s rate limit. Returns 429 if exceeded."""
    now = time.monotonic()
    window = _rate_windows[player_id]
    # evict entries older than 1 second
    while window and now - window[0] > RATE_LIMIT_WINDOW:
        window.popleft()
    if len(window) >= RATE_LIMIT_MAX:
        return _error("RATE_LIMITED",
                      "Rate limit exceeded. Maximum 5 requests per second per player.",
                      request_id, 429, retry_after=1)
    window.append(now)
    return None


def _get_player_id_from_token(authorization: str) -> str:
    """
    In the mock, we accept any Bearer token. The token value itself is treated
    as the player ID if it looks like a UUID; otherwise we derive one from it.
    This allows callers to use any stable string as a player identity.
    """
    token = authorization.removeprefix("Bearer ").strip()
    try:
        uuid.UUID(token)
        return token
    except ValueError:
        # Derive a deterministic UUID from the token string
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, token))


# ─── Grid generation ─────────────────────────────────────────────────────────

def _random_grid(rows: int = 3, cols: int = 5,
                 force_scatter: bool = False) -> list[list[str]]:
    """Generate a random rows×cols grid. force_scatter guarantees one SC."""
    grid = [[random.choice(WINNING_SYMBOLS) for _ in range(cols)]
            for _ in range(rows)]
    if force_scatter:
        r, c = random.randrange(rows), random.randrange(cols)
        grid[r][c] = "SC"
    return grid


def _make_position(row: int, col: int) -> dict[str, int]:
    return {"row": row, "col": col}


def _make_lightning_mark_set(positions: list[dict[str, int]]) -> dict[str, Any]:
    return {"positions": positions, "count": len(positions)}


# ─── Cascade simulation ───────────────────────────────────────────────────────

def _simulate_cascade(initial_grid: list[list[str]],
                      base_bet: float,
                      target_win_mult: float) -> dict[str, Any]:
    """
    Produce a cascade sequence. We simulate 1-3 cascade steps with small wins.
    Lightning Marks accumulate on winning positions.
    """
    steps = []
    all_lightning: list[dict[str, int]] = []
    current_grid = [row[:] for row in initial_grid]
    rows = len(current_grid)
    cols = len(current_grid[0])
    total_win = 0.0

    num_steps = random.randint(1, 3)
    for step_idx in range(num_steps):
        # Pick 1-2 win lines per step
        num_wins = random.randint(1, 2)
        win_lines = []
        step_win = 0.0
        new_lm: list[dict[str, int]] = []

        for wl_idx in range(num_wins):
            sym = random.choice(WINNING_SYMBOLS)
            match_count = random.randint(3, min(5, cols))
            start_col = 0
            positions = [_make_position(random.randrange(rows), c)
                         for c in range(start_col, start_col + match_count)]
            payout = round(base_bet * random.uniform(0.5, target_win_mult / num_steps / num_wins), 2)
            step_win += payout
            win_lines.append({
                "paylineId": wl_idx + 1 + step_idx * 2,
                "symbolId": sym,
                "matchCount": match_count,
                "positions": positions,
                "payout": payout,
            })
            # Mark winning positions as lightning marks
            for pos in positions:
                if pos not in all_lightning:
                    all_lightning.append(pos)
                    new_lm.append(pos)

        total_win += step_win

        steps.append({
            "index": step_idx,
            "grid": [row[:] for row in current_grid],
            "winLines": win_lines,
            "stepWin": round(step_win, 2),
            "newLightningMarks": new_lm,
            "rows": rows,
        })

        # Expand grid by 1 row after each cascade (up to 6)
        if rows < 6 and step_idx < num_steps - 1:
            rows += 1
            new_row = [random.choice(WINNING_SYMBOLS) for _ in range(cols)]
            current_grid.append(new_row)

    final_grid = current_grid
    return {
        "steps": steps,
        "totalWin": round(total_win, 2),
        "finalGrid": final_grid,
        "finalRows": rows,
        "lightningMarks": _make_lightning_mark_set(all_lightning),
    }


def _simulate_zero_cascade(grid: list[list[str]]) -> dict[str, Any]:
    """Cascade with no wins (loss spin)."""
    return {
        "steps": [],
        "totalWin": 0.0,
        "finalGrid": grid,
        "finalRows": 3,
        "lightningMarks": _make_lightning_mark_set([]),
    }


# ─── FG simulation ────────────────────────────────────────────────────────────

def _simulate_fg_sequence(base_bet: float,
                           initial_multiplier_idx: int,
                           bonus_mult: int,
                           force_all_heads: bool = False) -> dict[str, Any]:
    """
    Run up to 5 FG rounds, advancing through the multiplier ladder on HEADS.
    Returns list of FGRound dicts plus aggregate totalFGWin.
    """
    rounds = []
    total_fg_win = 0.0
    lm_positions: list[dict[str, int]] = []
    mult_idx = initial_multiplier_idx
    current_multiplier = FG_MULTIPLIER_SEQUENCE[mult_idx]

    for rnd in range(1, 6):
        grid = _random_grid(3, 5)
        round_win = round(base_bet * random.uniform(1.0, 5.0), 2)
        cascade = _simulate_cascade(grid, base_bet, 3.0)
        round_win = cascade["totalWin"]
        total_fg_win += round_win

        lm_before = _make_lightning_mark_set(list(lm_positions))
        new_lms = cascade["lightningMarks"]["positions"]
        for p in new_lms:
            if p not in lm_positions:
                lm_positions.append(p)
        lm_after = _make_lightning_mark_set(list(lm_positions))

        # Coin toss probability decreases as multiplier advances
        coin_toss_probs = [0.70, 0.55, 0.40, 0.30, 0.0]
        if force_all_heads:
            coin_result = "HEADS"
        else:
            coin_result = "HEADS" if random.random() < coin_toss_probs[mult_idx] else "TAILS"

        rounds.append({
            "round": rnd,
            "multiplier": current_multiplier,
            "bonusMultiplier": bonus_mult,
            "grid": grid,
            "cascadeSequence": cascade,
            "roundWin": round_win,
            "coinTossResult": coin_result,
            "lightningMarksBefore": lm_before,
            "lightningMarksAfter": lm_after,
        })

        if coin_result == "TAILS" or rnd == 5:
            break

        # Advance multiplier on HEADS
        if mult_idx < len(FG_MULTIPLIER_SEQUENCE) - 1:
            mult_idx += 1
            current_multiplier = FG_MULTIPLIER_SEQUENCE[mult_idx]

    final_multiplier = FG_MULTIPLIER_SEQUENCE[mult_idx]
    return {
        "rounds": rounds,
        "finalMultiplier": final_multiplier,
        "totalFGWin": round(total_fg_win, 2),
    }


# ─── Thunder Blessing simulation ─────────────────────────────────────────────

def _simulate_thunder_blessing(
        lightning_marks: list[dict[str, int]]) -> tuple[dict[str, Any], str]:
    """
    Simulate Thunder Blessing. Returns (ThunderBlessingResult, upgradedSymbol).
    Second hit applied with probability 0.40.
    """
    upgraded = random.choice(PREMIUM_SYMBOLS)
    second_hit = random.random() < 0.40
    result = {
        "marksConverted": lightning_marks,
        "convertedSymbol": upgraded,
        "firstHitApplied": True,
        "secondHitApplied": second_hit,
    }
    return result, upgraded


# ─── FastAPI application ──────────────────────────────────────────────────────

app = FastAPI(
    title="Thunder Blessing Slot Game — Mock API",
    version="1.0.0",
    description="Mock server for frontend integration. All data is synthetic.",
)


# ─── Health / Readiness (no auth) ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "thunder-blessing-mock"}


@app.get("/ready")
def ready():
    return {"status": "ready"}


# ─── POST /v1/spin ────────────────────────────────────────────────────────────

class SpinRequest(BaseModel):
    playerId: str
    sessionId: Optional[str] = None
    betLevel: int
    currency: str
    extraBet: bool
    buyFeature: bool


@app.post("/v1/spin")
async def post_spin(
    body: SpinRequest,
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(default=None),
):
    request_id = _new_request_id()

    # Auth check
    auth_err = _check_auth(authorization, request_id)
    if auth_err:
        return auth_err

    player_id = _get_player_id_from_token(authorization)

    # Rate limit
    rate_err = _check_rate_limit(player_id, request_id)
    if rate_err:
        return rate_err

    # Currency validation
    if body.currency not in ("USD", "TWD"):
        return _error("INVALID_CURRENCY",
                      f"currency '{body.currency}' is not USD or TWD",
                      request_id, 400)

    currency_config = _BET_INDEX.get(body.currency, {})
    max_level = BET_CONFIG["betRange"][body.currency]["maxBetLevel"]

    # Bet level validation
    if body.betLevel < 1 or body.betLevel > max_level or body.betLevel not in currency_config:
        return _error("INVALID_BET_LEVEL",
                      f"betLevel {body.betLevel} is outside the valid range for "
                      f"{body.currency} (1–{max_level})",
                      request_id, 400)

    level_data = currency_config[body.betLevel]
    base_bet = level_data["baseBet"]

    # Calculate totalBet
    if body.extraBet and body.buyFeature:
        total_bet = round(base_bet * 300, 4)
    elif body.buyFeature:
        total_bet = round(base_bet * 100, 4)
    elif body.extraBet:
        total_bet = round(base_bet * 3, 4)
    else:
        total_bet = base_bet

    # Balance check
    balance_before = _balances[player_id]
    if balance_before < total_bet:
        return _error("INSUFFICIENT_FUNDS",
                      "Insufficient balance to cover the spin cost",
                      request_id, 400)

    # Debit
    _balances[player_id] = round(balance_before - total_bet, 4)
    balance_before_spin = balance_before

    # ── Spin outcome simulation ───────────────────────────────────────────────

    spin_id = f"spin-{uuid.uuid4()}"
    session_id = body.sessionId or f"sess-{uuid.uuid4()}"

    is_buy_feature = body.buyFeature
    is_extra_bet = body.extraBet

    # Probability buckets
    rng = random.random()

    if is_buy_feature:
        # Buy Feature: guaranteed FG trigger
        fg_trigger = True
        win_spin = True
        thunder_trigger = random.random() < 0.30
    elif rng < 0.05:
        # FG trigger (5% base)
        fg_trigger = True
        win_spin = True
        thunder_trigger = random.random() < 0.25
    elif rng < 0.25:
        # Thunder Blessing (20%)
        fg_trigger = False
        win_spin = True
        thunder_trigger = True
    else:
        # Normal win / loss
        fg_trigger = False
        win_spin = rng < 0.80  # 80% have some win
        thunder_trigger = False

    # Build initial grid
    initial_grid = _random_grid(3, 5, force_scatter=is_extra_bet or fg_trigger or thunder_trigger)

    # Cascade
    if win_spin:
        target_mult = random.uniform(0.5, 3.0)
        cascade = _simulate_cascade(initial_grid, base_bet, target_mult)
    else:
        cascade = _simulate_zero_cascade(initial_grid)

    cascade_win = cascade["totalWin"]
    lightning_positions = cascade["lightningMarks"]["positions"]
    lightning_count = cascade["lightningMarks"]["count"]
    final_grid = cascade["finalGrid"]
    final_rows = cascade["finalRows"]

    # Thunder Blessing
    tb_triggered = thunder_trigger and lightning_count >= 1
    tb_result = None
    upgraded_symbol = None
    tb_first_hit = False
    tb_second_hit = False

    if tb_triggered:
        tb_result, upgraded_symbol = _simulate_thunder_blessing(lightning_positions)
        tb_first_hit = tb_result["firstHitApplied"]
        tb_second_hit = tb_result["secondHitApplied"]

    # Coin Toss (only possible when grid reached 6 rows AND cascade had wins)
    coin_toss_triggered = final_rows == 6 and cascade_win > 0 and not is_buy_feature
    coin_toss_result = None
    if coin_toss_triggered:
        coin_toss_result = "HEADS" if random.random() < 0.70 else "TAILS"

    # If buy feature, override coin toss path — goes straight to FG
    if is_buy_feature:
        coin_toss_triggered = False
        coin_toss_result = None

    # FG sequence
    fg_triggered = fg_trigger or (coin_toss_result == "HEADS")
    fg_rounds_data: list[dict[str, Any]] = []
    fg_multiplier = None
    fg_bonus_multiplier = None
    total_fg_win: Optional[float] = None

    if fg_triggered:
        bonus_mult = random.choice(FG_BONUS_MULTIPLIERS)
        fg_sim = _simulate_fg_sequence(
            base_bet,
            initial_multiplier_idx=0,
            bonus_mult=bonus_mult,
            force_all_heads=is_buy_feature,
        )
        fg_rounds_data = fg_sim["rounds"]
        fg_multiplier = fg_sim["finalMultiplier"]
        fg_bonus_multiplier = bonus_mult
        total_fg_win = fg_sim["totalFGWin"]

    # Session floor for Buy Feature
    session_floor_applied = False
    session_floor_value = None
    if is_buy_feature:
        if is_extra_bet:
            session_floor_value = round(base_bet * 60, 4)
        else:
            session_floor_value = round(base_bet * 20, 4)

    # Compute totalWin
    main_win = cascade_win
    if fg_triggered and total_fg_win is not None and fg_multiplier is not None and fg_bonus_multiplier is not None:
        effective_fg_win = total_fg_win * fg_multiplier * fg_bonus_multiplier
    else:
        effective_fg_win = 0.0

    total_win = round(main_win + effective_fg_win, 4)

    if is_buy_feature and session_floor_value is not None and total_win < session_floor_value:
        total_win = session_floor_value
        session_floor_applied = True

    # Credit wallet
    _balances[player_id] = round(_balances[player_id] + total_win, 4)
    new_balance = _balances[player_id]

    # Store session for GET /v1/session/{sessionId}
    _sessions[session_id] = {
        "sessionId": session_id,
        "playerId": player_id,
        "status": "FG_ACTIVE" if fg_triggered else "COMPLETE",
        "baseBet": base_bet,
        "currency": body.currency,
        "extraBet": is_extra_bet,
        "buyFeature": is_buy_feature,
        "fgRound": len(fg_rounds_data) if fg_triggered else 0,
        "fgMultiplier": fg_multiplier,
        "fgBonusMultiplier": fg_bonus_multiplier,
        "totalFGWin": total_fg_win if total_fg_win is not None else 0.0,
        "lightningMarks": cascade["lightningMarks"],
        "floorValue": session_floor_value,
        "completedRounds": fg_rounds_data,
        "remainingMaxRounds": max(0, 5 - len(fg_rounds_data)),
        "ttlSeconds": 1800,
        "_created_at": time.monotonic(),
    }

    # Build response data
    spin_data: dict[str, Any] = {
        "spinId": spin_id,
        "sessionId": session_id,
        "playerId": body.playerId,
        "betLevel": body.betLevel,
        "baseBet": base_bet,
        "totalBet": total_bet,
        "totalWin": total_win,
        "newBalance": new_balance,
        "currency": body.currency,
        "extraBetActive": is_extra_bet,
        "buyFeatureActive": is_buy_feature,
        "initialGrid": initial_grid,
        "finalGrid": final_grid,
        "finalRows": final_rows,
        "cascadeSequence": cascade,
        "thunderBlessingTriggered": tb_triggered,
        "thunderBlessingFirstHit": tb_first_hit,
        "thunderBlessingSecondHit": tb_second_hit,
        "upgradedSymbol": upgraded_symbol,
        "thunderBlessingResult": tb_result,
        "coinTossTriggered": coin_toss_triggered,
        "coinTossResult": coin_toss_result,
        "fgTriggered": fg_triggered,
        "fgMultiplier": fg_multiplier,
        "fgRounds": fg_rounds_data,
        "fgBonusMultiplier": fg_bonus_multiplier,
        "totalFGWin": total_fg_win,
        "sessionFloorApplied": session_floor_applied,
        "sessionFloorValue": session_floor_value,
        "nearMissApplied": False,
        "engineVersion": ENGINE_VERSION,
        "timestamp": _now_iso(),
        "rngSeed": None,
    }

    response.headers["X-Request-Id"] = request_id
    window = _rate_windows[player_id]
    remaining = max(0, RATE_LIMIT_MAX - len(window))
    response.headers["X-Rate-Limit-Remaining"] = str(remaining)

    return _success(spin_data, request_id)


# ─── GET /v1/session/{sessionId} ─────────────────────────────────────────────

@app.get("/v1/session/{session_id}")
async def get_session(
    session_id: str,
    authorization: Optional[str] = Header(default=None),
):
    request_id = _new_request_id()

    auth_err = _check_auth(authorization, request_id)
    if auth_err:
        return auth_err

    player_id = _get_player_id_from_token(authorization)

    session = _sessions.get(session_id)
    if session is None:
        return _error("SESSION_NOT_FOUND",
                      "Session not found or expired (TTL 1800s)",
                      request_id, 404)

    # TTL check (1800s)
    age = time.monotonic() - session["_created_at"]
    if age > 1800:
        del _sessions[session_id]
        return _error("SESSION_NOT_FOUND",
                      "Session not found or expired (TTL 1800s)",
                      request_id, 404)

    # Ownership check
    if session["playerId"] != player_id:
        return _error("FORBIDDEN",
                      "Player account is suspended or access to this resource is denied",
                      request_id, 403)

    ttl_remaining = max(0, int(1800 - age))

    data = {
        "sessionId": session["sessionId"],
        "playerId": session["playerId"],
        "status": session["status"],
        "baseBet": session["baseBet"],
        "currency": session["currency"],
        "extraBet": session["extraBet"],
        "buyFeature": session["buyFeature"],
        "fgRound": session["fgRound"],
        "fgMultiplier": session["fgMultiplier"],
        "fgBonusMultiplier": session["fgBonusMultiplier"],
        "totalFGWin": session["totalFGWin"],
        "lightningMarks": session["lightningMarks"],
        "floorValue": session["floorValue"],
        "completedRounds": session["completedRounds"],
        "remainingMaxRounds": session["remainingMaxRounds"],
        "ttlSeconds": ttl_remaining,
    }

    return _success(data, request_id)


# ─── GET /v1/config ───────────────────────────────────────────────────────────

@app.get("/v1/config")
async def get_config(
    currency: Optional[str] = Query(default=None, regex="^(USD|TWD)$"),
    authorization: Optional[str] = Header(default=None),
):
    request_id = _new_request_id()

    auth_err = _check_auth(authorization, request_id)
    if auth_err:
        return auth_err

    bet_range: dict[str, Any] = {}
    for cur, cfg in BET_CONFIG["betRange"].items():
        if currency and cur != currency:
            continue
        bet_range[cur] = {
            "minBetLevel": cfg["minBetLevel"],
            "maxBetLevel": cfg["maxBetLevel"],
            "levels": cfg["levels"],
        }

    config_data: dict[str, Any] = {
        "engineVersion": ENGINE_VERSION,
        "betRange": bet_range,
        "gameParameters": {
            "reels": 5,
            "initialRows": 3,
            "maxRows": 6,
            "paylines": {
                "at3Rows": 25,
                "at4Rows": 33,
                "at5Rows": 45,
                "at6Rows": 57,
            },
            "symbols": [
                {"id": "W",  "name": "Wild",       "isWild": True,  "isScatter": False},
                {"id": "SC", "name": "Scatter",    "isWild": False, "isScatter": True},
                {"id": "P1", "name": "Premium 1",  "isWild": False, "isScatter": False, "tier": "premium"},
                {"id": "P2", "name": "Premium 2",  "isWild": False, "isScatter": False, "tier": "premium"},
                {"id": "P3", "name": "Premium 3",  "isWild": False, "isScatter": False, "tier": "premium"},
                {"id": "P4", "name": "Premium 4",  "isWild": False, "isScatter": False, "tier": "premium"},
                {"id": "L1", "name": "Low 1",      "isWild": False, "isScatter": False, "tier": "low"},
                {"id": "L2", "name": "Low 2",      "isWild": False, "isScatter": False, "tier": "low"},
                {"id": "L3", "name": "Low 3",      "isWild": False, "isScatter": False, "tier": "low"},
                {"id": "L4", "name": "Low 4",      "isWild": False, "isScatter": False, "tier": "low"},
            ],
            "fgMultiplierSequence": FG_MULTIPLIER_SEQUENCE,
            "fgBonusMultipliers": FG_BONUS_MULTIPLIERS,
            "coinTossProbabilities": {
                "stage0_entry": 0.70,
                "stage1_x7":   0.55,
                "stage2_x17":  0.40,
                "stage3_x27":  0.30,
                "stage4_x77":  0.0,
            },
            "maxWin": {
                "mainGame":         5000,
                "buyFeature":       10000,
                "extraBetBuyFeature": 15000,
                "unit": "× baseBet",
            },
            "buyFeatureSessionFloor": 20,
            "extraBetCostMultiplier": 3,
            "buyFeatureCostMultiplier": 100,
        },
        "rtpTargets": {
            "mainGame":    {"target": 96.5, "tolerance": 1.0, "unit": "%"},
            "extraBet":    {"target": 97.5, "tolerance": 1.0, "unit": "%"},
            "buyFeature":  {"target": 97.0, "tolerance": 1.0, "unit": "%"},
            "ebBuyFeature": {"target": 97.8, "tolerance": 1.0, "unit": "%"},
        },
    }

    return _success(config_data, request_id)
