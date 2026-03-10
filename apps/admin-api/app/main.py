import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    analytics_router,
    auth_router,
    health_router,
    problems_router,
    submissions_router,
    tests_router,
    users_router,
)
from app.services import (
    AdminAnalyticsService,
    AdminAuthService,
    AdminProblemService,
    AdminProblemTestService,
    AdminSubmissionService,
    AdminUserService,
    MicrosoftOidcService,
    PsycopgAdminAnalyticsService,
    PsycopgAdminAuthService,
    PsycopgAdminProblemTestService,
    PsycopgAdminSubmissionService,
    PsycopgAdminUserService,
    PsycopgProblemListService,
    UnconfiguredAdminAuthService,
)
from app.core.auth import AdminAuthConfigError


def _load_admin_web_origins() -> list[str]:
    raw_origins = os.getenv(
        "ADMIN_WEB_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def create_app(
    auth_service: AdminAuthService | None = None,
    oidc_service: MicrosoftOidcService | None = None,
    problem_list_service: AdminProblemService | None = None,
    problem_test_service: AdminProblemTestService | None = None,
    submission_service: AdminSubmissionService | None = None,
    user_service: AdminUserService | None = None,
    analytics_service: AdminAnalyticsService | None = None,
) -> FastAPI:
    app = FastAPI(title="admin-api", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_load_admin_web_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.problem_service = problem_list_service or PsycopgProblemListService.from_env()
    app.state.problem_test_service = (
        problem_test_service or PsycopgAdminProblemTestService.from_env()
    )
    app.state.submission_service = submission_service or PsycopgAdminSubmissionService.from_env()
    app.state.user_service = user_service or PsycopgAdminUserService.from_env()
    if auth_service is not None:
        app.state.auth_service = auth_service
    else:
        try:
            app.state.auth_service = PsycopgAdminAuthService.from_env(oidc_service)
        except AdminAuthConfigError as exc:
            app.state.auth_service = UnconfiguredAdminAuthService(str(exc))
    app.state.analytics_service = analytics_service or PsycopgAdminAnalyticsService.from_env()
    app.include_router(auth_router)
    app.include_router(health_router)
    app.include_router(problems_router)
    app.include_router(submissions_router)
    app.include_router(tests_router)
    app.include_router(users_router)
    app.include_router(analytics_router)
    return app


app = create_app()
