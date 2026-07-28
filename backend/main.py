from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os, shutil, time, json

from obs_logger import obs_log, clear_active_traces, new_request_id, current_request_id

from db import get_db, engine
from graph import graph, AgentState
from rag import process_and_store_pdf, process_and_store_text
from langchain_core.messages import HumanMessage,AIMessage
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from langfuse.callback import CallbackHandler

security = HTTPBearer()

langfuse_handler = CallbackHandler()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SECRET_KEY = "secret"
ALGORITHM = "HS256"

# --- Auth & Models ---
class LoginRequest(BaseModel): username: str; password: str
class ChatRequest(BaseModel):
    message: str
    history: list[dict]
    pending_action: dict | None = None

class TextDocumentRequest(BaseModel): source: str; content: str

def create_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(hours=24)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@app.post("/api/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("SELECT id, password_hash, role, customer_id FROM users WHERE username = :u"), {"u": req.username})
    user = res.fetchone()
    if not user or not (req.password==user[1]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({"sub": req.username, "user_id": user[0], "role": user[2], "customer_id": user[3]})
    return {"token": token, "role": user[2], "customer_id": user[3]}

# --- Chat Endpoint ---
@app.post("/api/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id")
    customer_id = current_user.get("customer_id")
    username = current_user.get("sub", "unknown")

    # ── Observability: tag every log in this request with a unique ID ──────
    req_id = new_request_id()
    current_request_id.set(req_id)
    t_start = time.perf_counter()
    obs_log("api", "REQUEST_START", {
        "user": username,
        "customer_id": customer_id,
        "message": req.message[:120],
        "history_turns": len(req.history),
        "has_pending_action": req.pending_action is not None,
    })
    # ──────────────────────────────────────────────────────────────────────

    # Save user message
    await db.execute(text("INSERT INTO chat_history (user_id, role, content) VALUES (:uid, 'user', :msg)"), {"uid": user_id, "msg": req.message})
    
    # Build LangGraph State
    messages = [HumanMessage(content=m["content"]) if m["role"] == "user" else AIMessage(content=m["content"]) for m in req.history]
    messages.append(HumanMessage(content=req.message))
    
    state = {"messages": messages, "customer_id": customer_id, "step_count": 0, "pending_action": req.pending_action}

    print(f"Current State: {state}")
    # Run Graph
    result = await graph.ainvoke(state, config={"callbacks": [langfuse_handler]})
    response_text = result["messages"][-1].content

    duration_ms = int((time.perf_counter() - t_start) * 1000)
    trace = obs_log("api", "REQUEST_END", {
        "duration_ms": duration_ms,
        "steps": result.get("step_count", 0),
        "response_preview": response_text[:120],
    })
    
    if trace:
        # Save trace to DB
        await db.execute(
            text("INSERT INTO orchestration_logs (request_id, started_at, duration_ms, trace_data) VALUES (:rid, :start, :dur, :data)"),
            {"rid": req_id, "start": trace["started_at"], "dur": trace["duration_ms"], "data": json.dumps(trace)}
        )
    
    # Save assistant message
    await db.execute(text("INSERT INTO chat_history (user_id, role, content) VALUES (:uid, 'assistant', :msg)"), {"uid": user_id, "msg": response_text})
    await db.commit()
    
    return {"response": response_text, "pending_action": result.get("pending_action")}


@app.get("/api/history")
async def get_history(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id")
    res = await db.execute(text("SELECT role, content FROM chat_history WHERE user_id = :uid ORDER BY timestamp"), {"uid": user_id})
    return [{"role": r[0], "content": r[1]} for r in res.fetchall()]

@app.delete("/api/history")
async def clear_history(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id")
    await db.execute(text("DELETE FROM chat_history WHERE user_id = :uid"), {"uid": user_id})
    await db.commit()
    return {"status": "success"}

# --- Admin Endpoints ---
@app.post("/api/admin/upload-doc")
async def upload_doc(file: UploadFile = File(...), source: str = Form(None)):
    file_path = f"/tmp/{file.filename}"
    with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
    process_and_store_pdf(file_path, source_name=source or file.filename)
    return {"status": "success", "filename": file.filename}

@app.post("/api/admin/add-text")
async def add_text(req: TextDocumentRequest, db: AsyncSession = Depends(get_db)):
    from rag import process_and_store_text
    process_and_store_text(req.content, req.source)
    return {"status": "success"}

@app.delete("/api/admin/knowledge-base")
async def clear_knowledge_base_endpoint(db: AsyncSession = Depends(get_db)):
    from rag import clear_knowledge_base
    clear_knowledge_base()
    return {"status": "success"}

@app.get("/api/admin/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("SELECT u.username, c.package_name, c.data_balance_gb FROM users u LEFT JOIN customer_data c ON u.customer_id = c.customer_id"))
    return [{"username": r[0], "package": r[1], "balance": r[2]} for r in res.fetchall()]

@app.get("/api/admin/tickets")
async def get_tickets(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("SELECT t.ticket_id, u.username, t.issue_description, t.status, t.created_at FROM support_tickets t JOIN users u ON t.customer_id = u.customer_id ORDER BY t.created_at DESC"))
    return [{"ticket_id": r[0], "username": r[1], "issue_description": r[2], "status": r[3], "created_at": r[4]} for r in res.fetchall()]

@app.delete("/api/admin/tickets")
async def clear_tickets(db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM support_tickets"))
    await db.commit()
    return {"status": "success"}

# ── Observability endpoints ───────────────────────────────────────────────
@app.get("/api/admin/logs")
async def get_logs(db: AsyncSession = Depends(get_db)):
    """Return the last 50 completed request traces from the database."""
    res = await db.execute(text("SELECT trace_data FROM orchestration_logs ORDER BY started_at DESC LIMIT 50"))
    # trace_data is JSONB, sqlalchemy returns it as a dict or string. Ensure it's dict.
    return [r[0] if isinstance(r[0], dict) else json.loads(r[0]) for r in res.fetchall()]

@app.delete("/api/admin/logs")
async def clear_logs(db: AsyncSession = Depends(get_db)):
    """Flush the log buffer from DB and memory."""
    await db.execute(text("DELETE FROM orchestration_logs"))
    await db.commit()
    clear_active_traces()
    return {"status": "cleared"}