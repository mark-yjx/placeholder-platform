import json

from pydantic import BaseModel, field_validator


def _validate_json_text(value: str, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} is required.")

    try:
        json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{field_name} must be valid JSON text.") from exc

    return value


class AdminProblemTestCase(BaseModel):
    input: str
    output: str

    @field_validator("input", "output", mode="after")
    @classmethod
    def validate_json_text(cls, value: str, info) -> str:
        return _validate_json_text(value, info.field_name)


class AdminProblemTestsDetail(BaseModel):
    problemId: str
    publicTests: list[AdminProblemTestCase]
    hiddenTests: list[AdminProblemTestCase]


class AdminProblemTestsUpdateRequest(BaseModel):
    publicTests: list[AdminProblemTestCase]
    hiddenTests: list[AdminProblemTestCase]
