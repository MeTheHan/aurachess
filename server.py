from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Cookie
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
import uuid
import bcrypt
import jwt
import chess
import chess.engine
import asyncio
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
STOCKFISH_PATH = os.environ['STOCKFISH_PATH']
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ Models ============
class SignupRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class GoogleSessionRequest(BaseModel):
    session_id: str

class User(BaseModel):
    user_id: str
    username: str
    email: Optional[str] = None
    picture: Optional[str] = None
    elo: int = 800
    games_played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    created_at: str

class CreateAIGameRequest(BaseModel):
    bot_elo: int
    player_color: str  # "white" or "black"

class CreateOnlineGameRequest(BaseModel):
    player_color: str = "white"  # color the creator wants

class MoveRequest(BaseModel):
    from_sq: str
    to_sq: str
    promotion: Optional[str] = None

# ============ Lifespan (replaces deprecated @app.on_event) ============
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("username_lower", unique=True, sparse=True)
    await db.users.create_index("email", sparse=True)
    await db.games.create_index("game_id", unique=True)
    await db.games.create_index("status")  # FIX: index for waiting game queries
    await db.games.create_index("updated_at")
    await db.user_sessions.create_index("session_token", unique=True)
    yield
    # Shutdown
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ============ Helpers ============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_jwt(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("user_id")
    except Exception:
        return None

async def get_current_user(request: Request) -> dict:
    # Try cookie first (google session), then Authorization Bearer (jwt)
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            exp = sess["expires_at"]
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp >= datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        user_id = decode_jwt(token)
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
            if user:
                return user

    raise HTTPException(status_code=401, detail="Not authenticated")

# ============ Auth Routes ============
@api_router.post("/auth/signup")
async def signup(req: SignupRequest):
    username = req.username.strip()
    if len(username) < 3 or len(username) > 20:
        raise HTTPException(400, "Username must be 3-20 chars")
    if len(req.password) < 4:
        raise HTTPException(400, "Password too short")
    existing = await db.users.find_one({"username_lower": username.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Username taken")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "username": username,
        "username_lower": username.lower(),
        "password_hash": hash_password(req.password),
        "email": None,
        "picture": None,
        "elo": 800,
        "games_played": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_jwt(user_id)
    doc.pop("_id", None); doc.pop("password_hash", None); doc.pop("username_lower", None)
    return {"token": token, "user": doc}

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"username_lower": req.username.strip().lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_jwt(user["user_id"])
    user.pop("password_hash", None); user.pop("username_lower", None)
    return {"token": token, "user": user}

@api_router.post("/auth/google-session")
async def google_session(req: GoogleSessionRequest, response: Response):
    async with httpx.AsyncClient() as cli:
        r = await cli.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": req.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Invalid session")
    data = r.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        base = "".join(c for c in name if c.isalnum())[:15] or "player"
        username = base
        suffix = 0
        while await db.users.find_one({"username_lower": username.lower()}, {"_id": 0}):
            suffix += 1
            username = f"{base}{suffix}"
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "username": username,
            "username_lower": username.lower(),
            "email": email,
            "picture": picture,
            "elo": 800,
            "games_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
    else:
        if picture and not user.get("picture"):
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": picture}})
            user["picture"] = picture

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )
    user.pop("password_hash", None); user.pop("username_lower", None); user.pop("_id", None)
    return {"user": user}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    user.pop("username_lower", None)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ============ User Routes ============
@api_router.get("/leaderboard")
async def leaderboard():
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "username_lower": 0}).sort("elo", -1).limit(50).to_list(50)
    return users

@api_router.get("/users/me/history")
async def my_history(user: dict = Depends(get_current_user)):
    games = await db.games.find(
        {"$or": [{"white_user_id": user["user_id"]}, {"black_user_id": user["user_id"]}], "status": "finished"},
        {"_id": 0}
    ).sort("updated_at", -1).limit(50).to_list(50)
    return games

# ============ Chess / Game Routes ============
ELO_K = 32

def elo_update(rA: int, rB: int, score: float) -> int:
    expected = 1 / (1 + 10 ** ((rB - rA) / 400))
    return round(rA + ELO_K * (score - expected))

def board_state(game: dict) -> dict:
    board = chess.Board(game["fen"])
    result = None
    status = game["status"]
    if board.is_checkmate():
        status = "finished"
        result = "black_wins" if board.turn == chess.WHITE else "white_wins"
    elif board.is_stalemate() or board.is_insufficient_material() or board.is_seventyfive_moves() or board.is_fivefold_repetition():
        status = "finished"
        result = "draw"
    return {"status": status, "result": result, "turn": "white" if board.turn == chess.WHITE else "black", "in_check": board.is_check()}

async def stockfish_move(fen: str, elo: int) -> Optional[str]:
    """Get move from stockfish at target ELO. Returns UCI string."""
    def _run():
        try:
            engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
            board = chess.Board(fen)
            time_limit = 0.1 if elo < 1500 else 0.3 if elo < 2200 else 0.6
            # FIX: configure once based on elo range (avoids conflicting options)
            if elo < 1320:
                engine.configure({"UCI_LimitStrength": False, "Skill Level": max(0, (elo - 400) // 100)})
            else:
                engine.configure({"UCI_LimitStrength": True, "UCI_Elo": max(1320, min(elo, 3190))})
            result = engine.play(board, chess.engine.Limit(time=time_limit))
            engine.quit()
            return result.move.uci() if result.move else None
        except Exception as e:
            logger.error(f"Stockfish error: {e}")
            return None
    return await asyncio.to_thread(_run)

@api_router.post("/games/ai")
async def create_ai_game(req: CreateAIGameRequest, user: dict = Depends(get_current_user)):
    if req.player_color not in ("white", "black"):
        raise HTTPException(400, "Invalid color")
    if req.bot_elo < 400 or req.bot_elo > 3000:
        raise HTTPException(400, "ELO must be 400-3000")
    game_id = f"game_{uuid.uuid4().hex[:12]}"
    board = chess.Board()
    if req.player_color == "white":
        white_user = user; black_user = None
    else:
        white_user = None; black_user = user
    game = {
        "game_id": game_id,
        "type": "ai",
        "bot_elo": req.bot_elo,
        "white_user_id": white_user["user_id"] if white_user else None,
        "white_username": white_user["username"] if white_user else f"Bot {req.bot_elo}",
        "white_elo": white_user["elo"] if white_user else req.bot_elo,
        "black_user_id": black_user["user_id"] if black_user else None,
        "black_username": black_user["username"] if black_user else f"Bot {req.bot_elo}",
        "black_elo": black_user["elo"] if black_user else req.bot_elo,
        "fen": board.fen(),
        "moves": [],
        "status": "active",
        "result": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.games.insert_one(game)
    game.pop("_id", None)
    # If bot is white, make first move
    if req.player_color == "black":
        bot_move = await stockfish_move(game["fen"], req.bot_elo)
        if bot_move:
            b = chess.Board(game["fen"])
            b.push(chess.Move.from_uci(bot_move))
            game["fen"] = b.fen()
            game["moves"].append(bot_move)
            game["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.games.update_one({"game_id": game_id}, {"$set": {"fen": game["fen"], "moves": game["moves"], "updated_at": game["updated_at"]}})
    return game

# FIX: New endpoint — list waiting online games so players can find & join
@api_router.get("/games/waiting")
async def list_waiting_games(user: dict = Depends(get_current_user)):
    games = await db.games.find(
        {"type": "online", "status": "waiting"},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    return games

@api_router.post("/games/online")
async def create_online_game(req: CreateOnlineGameRequest, user: dict = Depends(get_current_user)):
    if req.player_color not in ("white", "black"):
        raise HTTPException(400, "Invalid color")
    game_id = f"game_{uuid.uuid4().hex[:12]}"
    if req.player_color == "white":
        game = {
            "game_id": game_id, "type": "online", "bot_elo": None,
            "white_user_id": user["user_id"], "white_username": user["username"], "white_elo": user["elo"],
            "black_user_id": None, "black_username": None, "black_elo": None,
            "fen": chess.Board().fen(), "moves": [], "status": "waiting", "result": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        game = {
            "game_id": game_id, "type": "online", "bot_elo": None,
            "white_user_id": None, "white_username": None, "white_elo": None,
            "black_user_id": user["user_id"], "black_username": user["username"], "black_elo": user["elo"],
            "fen": chess.Board().fen(), "moves": [], "status": "waiting", "result": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    await db.games.insert_one(game)
    game.pop("_id", None)
    return game

@api_router.post("/games/{game_id}/join")
async def join_game(game_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")
    if game["type"] != "online":
        raise HTTPException(400, "Not joinable")
    # Already a participant — return game as-is
    if game["white_user_id"] == user["user_id"] or game["black_user_id"] == user["user_id"]:
        return game
    if game["status"] != "waiting":
        raise HTTPException(400, "Game already started")
    update = {}
    if not game["white_user_id"]:
        update = {"white_user_id": user["user_id"], "white_username": user["username"], "white_elo": user["elo"]}
    elif not game["black_user_id"]:
        update = {"black_user_id": user["user_id"], "black_username": user["username"], "black_elo": user["elo"]}
    else:
        raise HTTPException(400, "Game is full")  # FIX: explicit error if both slots taken
    update["status"] = "active"
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.games.update_one({"game_id": game_id}, {"$set": update})
    game.update(update)
    return game

@api_router.get("/games/{game_id}")
async def get_game(game_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")
    return game

async def finalize_game_if_over(game: dict) -> dict:
    """Check chess board, set status/result, update ELOs if game is over."""
    board = chess.Board(game["fen"])
    if not board.is_game_over():
        return game
    if board.is_checkmate():
        game["result"] = "black_wins" if board.turn == chess.WHITE else "white_wins"
    else:
        game["result"] = "draw"
    game["status"] = "finished"
    game["updated_at"] = datetime.now(timezone.utc).isoformat()

    # ELO updates for online games with two real players
    if game["type"] == "online" and game["white_user_id"] and game["black_user_id"]:
        white = await db.users.find_one({"user_id": game["white_user_id"]}, {"_id": 0})
        black = await db.users.find_one({"user_id": game["black_user_id"]}, {"_id": 0})
        if white and black:
            if game["result"] == "white_wins":
                ws, bs = 1.0, 0.0
            elif game["result"] == "black_wins":
                ws, bs = 0.0, 1.0
            else:
                ws, bs = 0.5, 0.5
            new_white_elo = elo_update(white["elo"], black["elo"], ws)
            new_black_elo = elo_update(black["elo"], white["elo"], bs)
            await db.users.update_one({"user_id": white["user_id"]}, {
                "$set": {"elo": new_white_elo},
                "$inc": {"games_played": 1, "wins": 1 if ws == 1.0 else 0, "losses": 1 if ws == 0.0 else 0, "draws": 1 if ws == 0.5 else 0},
            })
            await db.users.update_one({"user_id": black["user_id"]}, {
                "$set": {"elo": new_black_elo},
                "$inc": {"games_played": 1, "wins": 1 if bs == 1.0 else 0, "losses": 1 if bs == 0.0 else 0, "draws": 1 if bs == 0.5 else 0},
            })
            game["white_elo_after"] = new_white_elo
            game["black_elo_after"] = new_black_elo

    elif game["type"] == "ai":
        player_id = game["white_user_id"] or game["black_user_id"]
        # FIX: guard against None bot_elo (shouldn't happen but defensive)
        bot_elo = game.get("bot_elo") or 800
        if player_id:
            player_is_white = bool(game["white_user_id"])
            if game["result"] == "draw":
                outcome = "draws"; score = 0.5
            elif (game["result"] == "white_wins" and player_is_white) or (game["result"] == "black_wins" and not player_is_white):
                outcome = "wins"; score = 1.0
            else:
                outcome = "losses"; score = 0.0
            player = await db.users.find_one({"user_id": player_id}, {"_id": 0})
            if player:
                new_elo = elo_update(player["elo"], bot_elo, score)
                await db.users.update_one({"user_id": player_id}, {
                    "$set": {"elo": new_elo},
                    "$inc": {"games_played": 1, outcome: 1},
                })
                # FIX: reflect new elo in returned game dict (consistent with online games)
                if player_is_white:
                    game["white_elo_after"] = new_elo
                else:
                    game["black_elo_after"] = new_elo
    return game

@api_router.post("/games/{game_id}/move")
async def make_move(game_id: str, req: MoveRequest, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] != "active":
        raise HTTPException(400, "Game not active")
    board = chess.Board(game["fen"])
    user_color = "white" if game["white_user_id"] == user["user_id"] else ("black" if game["black_user_id"] == user["user_id"] else None)
    if not user_color:
        raise HTTPException(403, "Not your game")
    turn = "white" if board.turn == chess.WHITE else "black"
    if turn != user_color:
        raise HTTPException(400, "Not your turn")

    # FIX: renamed to player_move_uci to avoid shadowing by bot_move_uci below
    player_move_uci = f"{req.from_sq}{req.to_sq}{req.promotion or ''}"
    try:
        move = chess.Move.from_uci(player_move_uci)
    except Exception:
        raise HTTPException(400, "Invalid move format")
    if move not in board.legal_moves:
        raise HTTPException(400, "Illegal move")
    board.push(move)
    game["fen"] = board.fen()
    game["moves"].append(player_move_uci)
    game["updated_at"] = datetime.now(timezone.utc).isoformat()
    game = await finalize_game_if_over(game)
    await db.games.update_one({"game_id": game_id}, {"$set": {
        "fen": game["fen"], "moves": game["moves"], "status": game["status"],
        "result": game["result"], "updated_at": game["updated_at"]
    }})

    # If AI game and still active, request bot move
    if game["type"] == "ai" and game["status"] == "active":
        bot_color = "black" if game["white_user_id"] else "white"
        b_turn = "white" if chess.Board(game["fen"]).turn == chess.WHITE else "black"
        if b_turn == bot_color:
            # FIX: use distinct variable name for bot's move
            bot_move_uci = await stockfish_move(game["fen"], game["bot_elo"])
            if bot_move_uci:
                bb = chess.Board(game["fen"])
                bb.push(chess.Move.from_uci(bot_move_uci))
                game["fen"] = bb.fen()
                game["moves"].append(bot_move_uci)
                game["updated_at"] = datetime.now(timezone.utc).isoformat()
                game = await finalize_game_if_over(game)
                await db.games.update_one({"game_id": game_id}, {"$set": {
                    "fen": game["fen"], "moves": game["moves"], "status": game["status"],
                    "result": game["result"], "updated_at": game["updated_at"]
                }})
    game.pop("_id", None)
    return game

@api_router.post("/games/{game_id}/resign")
async def resign(game_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] != "active":
        raise HTTPException(400, "Game not active")
    user_color = "white" if game["white_user_id"] == user["user_id"] else ("black" if game["black_user_id"] == user["user_id"] else None)
    if not user_color:
        raise HTTPException(403, "Not your game")
    game["status"] = "finished"
    game["result"] = "black_wins" if user_color == "white" else "white_wins"
    game["updated_at"] = datetime.now(timezone.utc).isoformat()

    if game["type"] == "online" and game["white_user_id"] and game["black_user_id"]:
        white = await db.users.find_one({"user_id": game["white_user_id"]}, {"_id": 0})
        black = await db.users.find_one({"user_id": game["black_user_id"]}, {"_id": 0})
        if white and black:
            ws = 0.0 if user_color == "white" else 1.0
            bs = 1.0 - ws
            new_white_elo = elo_update(white["elo"], black["elo"], ws)
            new_black_elo = elo_update(black["elo"], white["elo"], bs)
            await db.users.update_one({"user_id": white["user_id"]}, {"$set": {"elo": new_white_elo}, "$inc": {"games_played": 1, "wins": int(ws == 1.0), "losses": int(ws == 0.0)}})
            await db.users.update_one({"user_id": black["user_id"]}, {"$set": {"elo": new_black_elo}, "$inc": {"games_played": 1, "wins": int(bs == 1.0), "losses": int(bs == 0.0)}})
            game["white_elo_after"] = new_white_elo
            game["black_elo_after"] = new_black_elo

    elif game["type"] == "ai":
        player_id = game["white_user_id"] or game["black_user_id"]
        # FIX: guard against None bot_elo
        bot_elo = game.get("bot_elo") or 800
        if player_id:
            player = await db.users.find_one({"user_id": player_id}, {"_id": 0})
            if player:
                new_elo = elo_update(player["elo"], bot_elo, 0.0)
                await db.users.update_one({"user_id": player_id}, {"$set": {"elo": new_elo}, "$inc": {"games_played": 1, "losses": 1}})
                player_is_white = bool(game["white_user_id"])
                game["white_elo_after" if player_is_white else "black_elo_after"] = new_elo

    await db.games.update_one({"game_id": game_id}, {"$set": {
        "status": game["status"], "result": game["result"], "updated_at": game["updated_at"]
    }})
    return game

@api_router.get("/")
async def root():
    return {"app": "AURA CHESS", "status": "ok"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
