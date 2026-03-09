"""Service helpers for admin-api."""

from .admin_auth import (
    AdminAuthService,
    AdminOidcError,
    MicrosoftOidcService,
    PsycopgAdminAuthService,
    TotpVerificationError,
    UnconfiguredAdminAuthService,
)
from .problems import AdminProblemListService, AdminProblemService, PsycopgProblemListService
from .submissions import AdminSubmissionService, PsycopgAdminSubmissionService
from .tests import AdminProblemTestService, PsycopgAdminProblemTestService
from .users import (
    AdminUserService,
    PsycopgAdminUserService,
    UserAlreadyExistsError,
    UserOperationValidationError,
)

__all__ = [
    "AdminAuthService",
    "AdminProblemListService",
    "AdminProblemService",
    "AdminProblemTestService",
    "AdminOidcError",
    "AdminSubmissionService",
    "AdminUserService",
    "MicrosoftOidcService",
    "PsycopgAdminAuthService",
    "PsycopgAdminProblemTestService",
    "PsycopgAdminSubmissionService",
    "PsycopgAdminUserService",
    "PsycopgProblemListService",
    "TotpVerificationError",
    "UnconfiguredAdminAuthService",
    "UserAlreadyExistsError",
    "UserOperationValidationError",
]
