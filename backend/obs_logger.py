"""
obs_logger.py — Structured orchestration logger for the Telecom RAG Agent.

Writes JSON log lines to stdout (visible in docker compose logs backend) and
maintains an in-memory circular buffer of the last MAX_TRACES complete request
traces so they can be served via the /api/admin/logs endpoint.

Usage:
    from obs_logger import obs_log, get_traces, clear_traces, current_request_id

    # At request start (in main.py):
    request_id = str(uuid.uuid4())[:8]
    current_request_id.set(request_id)
    obs_log("api", "REQUEST_START", {"user": username, "message": message[:80]})

    # Anywhere else (in graph.py, rag.py, tools.py):
    obs_log("agent_node", "ENTER", {"step_count": step_count})
"""

import json
import logging
import uuid
from collections import deque
from contextvars import ContextVar
from datetime import datetime, timezone
from threading import Lock

# ── Configuration ────────────────────────────────────────────────────────────
MAX_TRACES = 50  # keep the last N completed traces in memory

# ── ContextVar ──────────────────────────────────────────────────────────────
# Flows through LangGraph's async tasks without explicit passing.
current_request_id: ContextVar[str] = ContextVar("current_request_id", default="no-request")

# ── Internal store ───────────────────────────────────────────────────────────
_lock = Lock()
_active: dict[str, dict] = {}                      # in-progress traces keyed by request_id

# ── Python stdlib logger (writes to stdout/stderr captured by Docker) ────────
_py_logger = logging.getLogger("telecom_agent")
if not _py_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    _py_logger.addHandler(handler)
    _py_logger.setLevel(logging.DEBUG)
    _py_logger.propagate = False


def obs_log(component: str, event: str, data: dict | None = None) -> dict | None:
    """
    Emit one structured log entry. Returns the full trace if event == 'REQUEST_END', else None.

    Parameters
    ----------
    component : str   e.g. "agent_node", "tool_node", "rag", "router", "api"
    event     : str   e.g. "ENTER", "TOOL_CALL", "ROUTE", "RAG_RESULT", ...
    data      : dict  arbitrary extra fields (will be truncated if strings are long)
    """
    request_id = current_request_id.get()
    now = datetime.now(timezone.utc).isoformat()

    # Truncate any string values longer than 300 chars to keep logs readable
    safe_data: dict = {}
    for k, v in (data or {}).items():
        if isinstance(v, str) and len(v) > 300:
            safe_data[k] = v[:300] + "…"
        else:
            safe_data[k] = v

    entry = {
        "ts": now,
        "request_id": request_id,
        "component": component,
        "event": event,
        "data": safe_data,
    }

    # Write to stdout as a compact JSON line
    _py_logger.info(json.dumps(entry, default=str))

    # Buffer into the active trace
    with _lock:
        if request_id not in _active:
            _active[request_id] = {
                "request_id": request_id,
                "started_at": now,
                "finished_at": None,
                "duration_ms": None,
                "steps": [],
            }
        _active[request_id]["steps"].append(entry)

        # When the request finishes, return the completed trace for DB persistence
        if event == "REQUEST_END":
            trace = _active.pop(request_id)
            trace["finished_at"] = now
            trace["duration_ms"] = safe_data.get("duration_ms")
            return trace
            
    return None


def clear_active_traces() -> None:
    """Flush any in-progress entries."""
    with _lock:
        _active.clear()


def new_request_id() -> str:
    """Generate a short 8-char request ID."""
    return str(uuid.uuid4())[:8]

