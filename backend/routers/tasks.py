from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Task, TaskState, Criticality
from schemas import TaskCreate, TaskUpdate, TaskOut
from services.google_calendar import push_task_to_calendar, delete_calendar_event

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=List[TaskOut])
def list_tasks(
    goal_id: Optional[str] = Query(None),
    state: Optional[TaskState] = Query(None),
    criticality: Optional[Criticality] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Task)
    if goal_id:
        q = q.filter(Task.goal_id == goal_id)
    if state:
        q = q.filter(Task.state == state)
    if criticality:
        q = q.filter(Task.criticality == criticality)
    return q.order_by(Task.start_date.asc().nullslast(), Task.created_at.desc()).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    event_id = push_task_to_calendar(task, db)
    if event_id:
        task.google_calendar_event_id = event_id
        db.commit()
        db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    event_id = push_task_to_calendar(task, db)
    if event_id:
        task.google_calendar_event_id = event_id
        db.commit()
        db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.google_calendar_event_id:
        delete_calendar_event(task.google_calendar_event_id)
    db.delete(task)
    db.commit()
