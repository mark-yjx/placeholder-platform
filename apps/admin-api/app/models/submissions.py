from typing import Literal

from pydantic import BaseModel


SubmissionStatus = Literal["queued", "running", "finished", "failed"]
SubmissionVerdict = Literal["AC", "WA", "TLE", "RE", "CE"]


class AdminSubmissionListItem(BaseModel):
    submissionId: str
    ownerUserId: str
    problemId: str
    status: SubmissionStatus
    verdict: SubmissionVerdict | None = None
    timeMs: int | None = None
    memoryKb: int | None = None
    submittedAt: str


class AdminSubmissionDetail(AdminSubmissionListItem):
    failureReason: str | None = None
    errorDetail: str | None = None
    sourceSnapshot: str | None = None
