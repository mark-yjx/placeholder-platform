import re
from typing import Literal

from pydantic import BaseModel, field_validator

PROBLEM_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
PYTHON_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _validate_non_empty(value: str, field_name: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError(f"{field_name} is required.")
    return trimmed


def _validate_entry_function(value: str) -> str:
    trimmed = _validate_non_empty(value, "entryFunction")
    if not PYTHON_IDENTIFIER_PATTERN.match(trimmed):
        raise ValueError("entryFunction must be a valid Python identifier.")
    return trimmed


def _validate_problem_id(value: str) -> str:
    trimmed = _validate_non_empty(value, "problemId")
    if not PROBLEM_ID_PATTERN.match(trimmed):
        raise ValueError(
            "problemId must use lowercase letters, numbers, underscores, or hyphens."
        )
    return trimmed


def _validate_starter_code(value: str, entry_function: str) -> str:
    if not value.strip():
        raise ValueError("starterCode is required.")

    pattern = re.compile(rf"(^|\n)\s*(?:async\s+def|def)\s+{re.escape(entry_function)}\s*\(")
    if not pattern.search(value):
        raise ValueError(
            "starterCode must define the configured entryFunction explicitly."
        )

    return value


class AdminProblemListItem(BaseModel):
    problemId: str
    title: str
    visibility: str
    updatedAt: str


class AdminProblemDetail(BaseModel):
    problemId: str
    title: str
    entryFunction: str
    language: Literal["python"]
    timeLimitMs: int
    memoryLimitKb: int
    visibility: Literal["draft", "public", "private"]
    statementMarkdown: str
    starterCode: str
    updatedAt: str


class AdminProblemCreateRequest(BaseModel):
    problemId: str
    title: str
    entryFunction: str
    language: Literal["python"]
    timeLimitMs: int
    memoryLimitKb: int

    @field_validator("problemId", mode="after")
    @classmethod
    def validate_problem_id(cls, value: str) -> str:
        return _validate_problem_id(value)

    @field_validator("title", mode="after")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _validate_non_empty(value, "title")

    @field_validator("entryFunction", mode="after")
    @classmethod
    def validate_entry_function(cls, value: str) -> str:
        return _validate_entry_function(value)

    @field_validator("timeLimitMs", "memoryLimitKb", mode="after")
    @classmethod
    def validate_positive_limits(cls, value: int, info) -> int:
        if value <= 0:
            raise ValueError(f"{info.field_name} must be greater than zero.")
        return value


class AdminProblemUpdateRequest(BaseModel):
    problemId: str
    title: str
    entryFunction: str
    language: Literal["python"]
    timeLimitMs: int
    memoryLimitKb: int
    visibility: Literal["draft", "public", "private"]
    statementMarkdown: str
    starterCode: str

    @field_validator("problemId", mode="after")
    @classmethod
    def validate_problem_id(cls, value: str) -> str:
        return _validate_problem_id(value)

    @field_validator("title", mode="after")
    @classmethod
    def validate_required_text(cls, value: str, info) -> str:
        return _validate_non_empty(value, info.field_name)

    @field_validator("entryFunction", mode="after")
    @classmethod
    def validate_entry_function(cls, value: str) -> str:
        return _validate_entry_function(value)

    @field_validator("statementMarkdown", mode="after")
    @classmethod
    def validate_statement_markdown(cls, value: str) -> str:
        return _validate_non_empty(value, "statementMarkdown")

    @field_validator("timeLimitMs", "memoryLimitKb", mode="after")
    @classmethod
    def validate_positive_limits(cls, value: int, info) -> int:
        if value <= 0:
            raise ValueError(f"{info.field_name} must be greater than zero.")
        return value

    @field_validator("starterCode", mode="after")
    @classmethod
    def validate_starter_code(cls, value: str, info) -> str:
        entry_function = info.data.get("entryFunction")
        if not isinstance(entry_function, str) or not entry_function:
            return value
        return _validate_starter_code(value, entry_function)
