# Task Start Date + Time Needed — Design Spec

**Date:** 2026-05-27  
**Status:** Approved

## Overview

Replace the single `deadline` datetime field on tasks with two fields:

- `start_date` — the date the task begins (nullable `DATE`)
- `time_needed` — how many calendar days the task spans (`INTEGER`, default 1, minimum 1)

These two fields define a span. The calendar sync uses that span to create an all-day iCal event covering exactly those days.

## Section 1 — Data Model

**Model:** `backend/models.py` → `Task`

Remove:
```python
deadline = Column(DateTime, nullable=True)
```

Add:
```python
start_date = Column(Date, nullable=True)
time_needed = Column(Integer, default=1, nullable=False)
```

`start_date` is nullable — a task with no scheduled date is valid. `time_needed` always has a value (default 1).

## Section 2 — API / Schemas

**Files:** `backend/schemas.py`, `frontend/src/lib/types.ts`

`TaskCreate`:
- Remove `deadline: Optional[datetime]`
- Add `start_date: Optional[date] = None`
- Add `time_needed: int = 1`

`TaskUpdate`:
- Remove `deadline: Optional[datetime]`
- Add `start_date: Optional[date] = None`
- Add `time_needed: Optional[int] = None`

`TaskOut`:
- Remove `deadline: Optional[datetime]`
- Add `start_date: Optional[date]`
- Add `time_needed: int`

`frontend/src/lib/types.ts` — `Task` interface:
- Remove `deadline: string | null`
- Add `start_date: string | null`
- Add `time_needed: number`

List endpoint ordering (`GET /api/tasks`) switches from `Task.deadline.asc().nullslast()` to `Task.start_date.asc().nullslast()`.

## Section 3 — Calendar Sync

**File:** `backend/services/google_calendar.py` → `_build_ical`

Switch from a timed event to an all-day iCal event:

```python
from datetime import date, timedelta
from icalendar import vDate

start = task.start_date or date.today()
end = start + timedelta(days=task.time_needed)

event.add("dtstart", vDate(start))
event.add("dtend", vDate(end))
```

iCal all-day events use bare `DATE` values (no time component, no timezone). CalDAV clients render these as banner/block events spanning the days.

Description line changes from time-based info to:
```
Time needed: N day(s)
```

If `start_date` is `None`, fall back to `date.today()` so the event still lands somewhere meaningful.

## Section 4 — Frontend

**Files:** `frontend/src/components/tasks/TaskForm.tsx`, `frontend/src/components/tasks/TaskCard.tsx`

`TaskForm`:
- Replace `datetime-local` deadline input with a `date` input bound to `start_date`
- Add a `number` input (min 1) for `time_needed`, labeled "Days needed"
- Form state: `start_date: string` (YYYY-MM-DD or empty), `time_needed: number`
- On submit: send `start_date: form.start_date || null`, `time_needed: Number(form.time_needed)`

`TaskCard`:
- Replace deadline display with start + end range
- If `start_date` is set: show `May 28 → May 30` (start to `start + time_needed - 1 days`, inclusive last day). Note: iCal `DTEND` is `start + time_needed days` (exclusive per the spec), but the display shows the inclusive end.
- If `start_date` is null: show "No schedule"

## Section 5 — Migration

**File:** `backend/migrate_deadline.py` (run once, then delete or keep as historical artifact)

Steps:
1. Add `start_date TEXT` column (nullable)
2. Add `time_needed INTEGER NOT NULL DEFAULT 1` column
3. Populate `start_date` from existing `deadline` values: `UPDATE tasks SET start_date = DATE(deadline) WHERE deadline IS NOT NULL`
4. Recreate the `tasks` table without the `deadline` column using SQLite's copy-rename pattern:
   - `CREATE TABLE tasks_new AS SELECT ... (all columns except deadline) FROM tasks`
   - `DROP TABLE tasks`
   - `ALTER TABLE tasks_new RENAME TO tasks`

Run with: `cd backend && uv run python migrate_deadline.py`

Safe to run on an empty database. Idempotent check: skip if `deadline` column no longer exists.

## Out of Scope

- Alembic / versioned migrations (this project uses raw SQLAlchemy `create_all`)
- Recurring tasks
- Time-of-day scheduling within a day
- Validation that `time_needed >= 1` beyond the default (backend will accept any positive int)
