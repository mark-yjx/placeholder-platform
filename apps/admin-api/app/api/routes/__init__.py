"""Route exports for the admin API scaffold."""

from .auth import router as auth_router
from .health import router as health_router
from .problems import router as problems_router
from .submissions import router as submissions_router
from .tests import router as tests_router
from .users import router as users_router

__all__ = [
    "auth_router",
    "health_router",
    "problems_router",
    "submissions_router",
    "tests_router",
    "users_router",
]
