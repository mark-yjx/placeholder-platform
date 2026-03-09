from fastapi import FastAPI

from app.api.routes import health_router


def create_app() -> FastAPI:
    app = FastAPI(title="admin-api", version="0.1.0")
    app.include_router(health_router)
    return app


app = create_app()
