from fastapi import FastAPI, Request, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from app.config import settings
from app.database import create_tables
from app.routers import auth, campaigns, leads, conversations, deals, analytics
from app.routers import settings as settings_router
from app.routers import outreach, import_csv
from app.websockets import ws_manager
from app.utils.auth import decode_token

logger = structlog.get_logger()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST Routers ──────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(campaigns.router)
app.include_router(leads.router)
app.include_router(conversations.router)
app.include_router(deals.router)
app.include_router(analytics.router)
app.include_router(settings_router.router)
app.include_router(outreach.router)
app.include_router(import_csv.router)


# ── WebSocket — real-time dashboard notifications ─────────────────────────────
@app.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub", 0))
    except Exception:
        await websocket.close(code=1008)
        return

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            # Keep alive — client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", path=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("Starting AI Leads System", version=settings.APP_VERSION)
    create_tables()
    logger.info("Database ready", url=settings.DATABASE_URL.split("@")[-1])


@app.get("/health")
def health():
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "docs": "/docs"}
