import uuid
import enum
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Float, DateTime, Date, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class GoalState(str, enum.Enum):
    active = "active"
    completed = "completed"
    abandoned = "abandoned"
    paused = "paused"


class TaskState(str, enum.Enum):
    pending = "pending"
    onhold = "onhold"
    cancelled = "cancelled"
    done = "done"


class Criticality(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Goal(Base):
    __tablename__ = "goals"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    metric_name = Column(String, nullable=False)
    metric_target = Column(Float, nullable=False)
    metric_current = Column(Float, default=0.0)
    state = Column(Enum(GoalState), default=GoalState.active, nullable=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    tasks = relationship("Task", back_populates="goal", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    goal_id = Column(String, ForeignKey("goals.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    time_needed = Column(Integer, default=1, nullable=False)
    time_spent = Column(Integer, default=0)  # minutes
    criticality = Column(Enum(Criticality), default=Criticality.medium, nullable=False)
    state = Column(Enum(TaskState), default=TaskState.pending, nullable=False)
    google_calendar_event_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    goal = relationship("Goal", back_populates="tasks")
