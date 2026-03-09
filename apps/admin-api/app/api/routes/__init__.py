"""Route exports for the admin API scaffold."""

from .health import router as health_router

__all__ = ["health_router"]
