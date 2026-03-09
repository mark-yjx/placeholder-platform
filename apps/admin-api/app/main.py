import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth_router, health_router, problems_router
from app.services import AdminProblemService, PsycopgProblemListService


def _load_admin_web_origins() -> list[str]:
    raw_origins = os.getenv(
        "ADMIN_WEB_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def create_app(problem_list_service: AdminProblemService | None = None) -> FastAPI:
    app = FastAPI(title="admin-api", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_load_admin_web_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.problem_service = problem_list_service or PsycopgProblemListService.from_env()
    app.include_router(auth_router)
    app.include_router(health_router)
    app.include_router(problems_router)
    return app


app = create_app()
