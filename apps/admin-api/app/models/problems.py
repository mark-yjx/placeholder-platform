from pydantic import BaseModel


class AdminProblemListItem(BaseModel):
    problemId: str
    title: str
    visibility: str
    updatedAt: str
