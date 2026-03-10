from pydantic import BaseModel


class AdminAnalyticsOverview(BaseModel):
    totalUsers: int
    activeUsers: int
    activeWindowDays: int
    totalSubmissions: int
    totalAcceptedSubmissions: int
    uniqueProblemSolves: int
