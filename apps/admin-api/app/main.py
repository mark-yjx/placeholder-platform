import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth_router, health_router


def _load_admin_web_origins() -> list[str]:
    raw_origins = os.getenv(
        "ADMIN_WEB_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def create_app() -> FastAPI:
    app = FastAPI(title="admin-api", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_load_admin_web_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth_router)
    app.include_router(health_router)
    return app


app = create_app()
