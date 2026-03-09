"""Route exports for the admin API scaffold."""

from .auth import router as auth_router
from .health import router as health_router
from .problems import router as problems_router

__all__ = ["auth_router", "health_router", "problems_router"]
