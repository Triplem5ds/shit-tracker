from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from models import GoalState, TaskState, Criticality


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    metric_name: str
    metric_target: float
    metric_current: float = 0.0
    state: GoalState = GoalState.active


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    metric_name: Optional[str] = None
    metric_target: Optional[float] = None
    metric_current: Optional[float] = None
    state: Optional[GoalState] = None


class GoalOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    metric_name: str
    metric_target: float
    metric_current: float
    state: GoalState
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    goal_id: str
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    time_needed: int = 1
    time_spent: int = 0
    criticality: Criticality = Criticality.medium
    state: TaskState = TaskState.pending


class TaskUpdate(BaseModel):
    goal_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    time_needed: Optional[int] = None
    time_spent: Optional[int] = None
    criticality: Optional[Criticality] = None
    state: Optional[TaskState] = None


class TaskOut(BaseModel):
    id: str
    goal_id: str
    title: str
    description: Optional[str]
    start_date: Optional[date]
    time_needed: int
    time_spent: int
    criticality: Criticality
    state: TaskState
    google_calendar_event_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
