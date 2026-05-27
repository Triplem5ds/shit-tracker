# Task start_date + time_needed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `deadline` datetime field on tasks with `start_date` (nullable date) + `time_needed` (int days), syncing to CalDAV as all-day spanning events.

**Architecture:** Migration script converts the existing SQLite table before any code changes ship. Backend model/schema/router changes are TDD'd with an in-memory SQLite test database. Frontend swaps the deadline datetime-picker for a date-picker + days input.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2, SQLite, icalendar, pytest, httpx; Next.js 16 App Router, TypeScript, Tailwind v4, Bun.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/pyproject.toml` | Modify | Add pytest + httpx dev deps |
| `backend/pytest.ini` | Create | Point pytest at tests/, set pythonpath |
| `backend/tests/__init__.py` | Create | Make tests a package |
| `backend/tests/conftest.py` | Create | In-memory SQLite TestClient fixture |
| `backend/tests/test_tasks.py` | Create | API tests for new fields |
| `backend/tests/test_calendar.py` | Create | Unit tests for all-day iCal generation |
| `backend/models.py` | Modify | Replace `deadline` with `start_date` + `time_needed` |
| `backend/schemas.py` | Modify | Update TaskCreate / TaskUpdate / TaskOut |
| `backend/routers/tasks.py` | Modify | Update ordering from deadline → start_date |
| `backend/services/google_calendar.py` | Modify | All-day iCal events via DATE values |
| `backend/migrate_deadline.py` | Create | One-time migration script |
| `frontend/src/lib/types.ts` | Modify | Task interface: swap deadline for new fields |
| `frontend/src/components/tasks/TaskForm.tsx` | Modify | date input + days input |
| `frontend/src/components/tasks/TaskCard.tsx` | Modify | Date range display, remove isOverdue |

---

## Task 1: Add test dependencies

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/pytest.ini`

- [ ] **Step 1: Add dev dependencies**

```bash
cd backend && uv add --dev pytest httpx
```

Expected: uv adds `pytest` and `httpx` under `[dependency-groups]` in `pyproject.toml`.

- [ ] **Step 2: Create pytest config**

Create `backend/pytest.ini`:
```ini
[pytest]
testpaths = tests
pythonpath = .
```

- [ ] **Step 3: Create test package**

```bash
mkdir -p backend/tests && touch backend/tests/__init__.py
```

- [ ] **Step 4: Verify pytest runs (no tests yet)**

```bash
cd backend && uv run pytest
```

Expected: `no tests ran` — no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/pytest.ini backend/tests/__init__.py
git commit -m "chore: add pytest + httpx dev deps and test scaffolding"
```

---

## Task 2: Write failing API tests

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_tasks.py`

- [ ] **Step 1: Write conftest.py**

Create `backend/tests/conftest.py`:
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture
def client():
    Base.metadata.create_all(bind=_engine)

    def override():
        db = _Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def goal_id(client):
    r = client.post("/api/goals", json={
        "title": "Test Goal",
        "metric_name": "tasks",
        "metric_target": 10,
    })
    assert r.status_code == 201
    return r.json()["id"]
```

- [ ] **Step 2: Write test_tasks.py**

Create `backend/tests/test_tasks.py`:
```python
def test_create_task_with_start_date(client, goal_id):
    r = client.post("/api/tasks", json={
        "goal_id": goal_id,
        "title": "My task",
        "start_date": "2026-05-28",
        "time_needed": 3,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["start_date"] == "2026-05-28"
    assert data["time_needed"] == 3
    assert "deadline" not in data


def test_create_task_defaults(client, goal_id):
    r = client.post("/api/tasks", json={
        "goal_id": goal_id,
        "title": "My task",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["start_date"] is None
    assert data["time_needed"] == 1


def test_update_task_time_needed(client, goal_id):
    r = client.post("/api/tasks", json={
        "goal_id": goal_id,
        "title": "T",
        "start_date": "2026-05-28",
        "time_needed": 1,
    })
    task_id = r.json()["id"]
    r2 = client.patch(f"/api/tasks/{task_id}", json={"time_needed": 5})
    assert r2.status_code == 200
    assert r2.json()["time_needed"] == 5


def test_list_tasks_ordered_by_start_date(client, goal_id):
    client.post("/api/tasks", json={"goal_id": goal_id, "title": "Later", "start_date": "2026-06-01", "time_needed": 1})
    client.post("/api/tasks", json={"goal_id": goal_id, "title": "Earlier", "start_date": "2026-05-28", "time_needed": 1})
    client.post("/api/tasks", json={"goal_id": goal_id, "title": "No date"})
    r = client.get("/api/tasks")
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert titles.index("Earlier") < titles.index("Later")
    assert titles[-1] == "No date"
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd backend && uv run pytest tests/test_tasks.py -v
```

Expected: errors like `422 Unprocessable Entity` or `AssertionError` — these fail because the model still has `deadline`.

- [ ] **Step 4: Commit failing tests**

```bash
git add backend/tests/conftest.py backend/tests/test_tasks.py
git commit -m "test: add failing API tests for start_date + time_needed fields"
```

---

## Task 3: Update models and schemas

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/schemas.py`
- Modify: `backend/routers/tasks.py`

- [ ] **Step 1: Update models.py**

In `backend/models.py`, change the import line from:
```python
from sqlalchemy import Column, String, Float, DateTime, Enum, ForeignKey, Integer, Text
```
to:
```python
from sqlalchemy import Column, String, Float, DateTime, Date, Enum, ForeignKey, Integer, Text
```

Add `date` to the datetime import:
```python
from datetime import datetime, timezone, date
```

In the `Task` class, replace:
```python
    deadline = Column(DateTime, nullable=True)
```
with:
```python
    start_date = Column(Date, nullable=True)
    time_needed = Column(Integer, default=1, nullable=False)
```

- [ ] **Step 2: Update schemas.py**

In `backend/schemas.py`, change:
```python
from datetime import datetime
```
to:
```python
from datetime import datetime, date
```

Replace the three task schemas entirely:
```python
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
```

- [ ] **Step 3: Update ordering in routers/tasks.py**

In `backend/routers/tasks.py`, replace:
```python
    return q.order_by(Task.deadline.asc().nullslast(), Task.created_at.desc()).all()
```
with:
```python
    return q.order_by(Task.start_date.asc().nullslast(), Task.created_at.desc()).all()
```

- [ ] **Step 4: Run API tests — verify they pass**

```bash
cd backend && uv run pytest tests/test_tasks.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/schemas.py backend/routers/tasks.py
git commit -m "feat: replace deadline with start_date + time_needed on Task model"
```

---

## Task 4: Write failing calendar tests

**Files:**
- Create: `backend/tests/test_calendar.py`

- [ ] **Step 1: Write test_calendar.py**

Create `backend/tests/test_calendar.py`:
```python
from datetime import date, datetime
from unittest.mock import MagicMock
from icalendar import Calendar as iCal

from services.google_calendar import _build_ical


def _task(start_date=None, time_needed=1):
    t = MagicMock()
    t.id = "abc-123"
    t.title = "Test Task"
    t.description = "some desc"
    t.criticality = "medium"
    t.state = "pending"
    t.time_needed = time_needed
    t.start_date = start_date
    t.google_calendar_event_id = None
    t.goal = MagicMock()
    t.goal.title = "Test Goal"
    return t


def test_all_day_event_dates():
    ical_bytes = _build_ical(_task(start_date=date(2026, 5, 28), time_needed=3))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        dtstart = component.get("dtstart").dt
        dtend = component.get("dtend").dt
        # Must be date, not datetime
        assert type(dtstart) is date, f"expected date, got {type(dtstart)}"
        assert type(dtend) is date, f"expected date, got {type(dtend)}"
        assert dtstart == date(2026, 5, 28)
        assert dtend == date(2026, 5, 31)  # exclusive end = start + 3


def test_single_day_event():
    ical_bytes = _build_ical(_task(start_date=date(2026, 6, 1), time_needed=1))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        assert component.get("dtstart").dt == date(2026, 6, 1)
        assert component.get("dtend").dt == date(2026, 6, 2)


def test_fallback_to_today_when_no_start_date():
    today = date.today()
    ical_bytes = _build_ical(_task(start_date=None, time_needed=2))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        dtstart = component.get("dtstart").dt
        assert type(dtstart) is date
        assert dtstart == today


def test_description_contains_time_needed():
    ical_bytes = _build_ical(_task(start_date=date(2026, 5, 28), time_needed=4))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        desc = str(component.get("description"))
        assert "4 day(s)" in desc
```

- [ ] **Step 2: Run — verify they fail**

```bash
cd backend && uv run pytest tests/test_calendar.py -v
```

Expected: all 4 tests FAIL (current `_build_ical` uses DateTime, not Date).

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/test_calendar.py
git commit -m "test: add failing calendar tests for all-day iCal events"
```

---

## Task 5: Update calendar service

**Files:**
- Modify: `backend/services/google_calendar.py`

- [ ] **Step 1: Update _build_ical in google_calendar.py**

First, update the top-level import in `google_calendar.py` from:
```python
from datetime import datetime, timezone, timedelta
```
to:
```python
from datetime import datetime, timezone, timedelta, date as date_type
```

Then replace the entire `_build_ical` function:
```python
def _build_ical(task) -> bytes:
    goal_title = task.goal.title if task.goal else "Unknown Goal"
    cal = iCal()
    cal.add("prodid", "-//Shit Tracker//EN")
    cal.add("version", "2.0")

    event = iEvent()
    event.add("uid", task.id + UID_SUFFIX)
    event.add("summary", f"[{goal_title}] {task.title}")
    event.add("description", (task.description or "") + f"\n\nCriticality: {task.criticality}\nState: {task.state}\nTime needed: {task.time_needed} day(s)")

    start = task.start_date if task.start_date else date_type.today()
    end = start + timedelta(days=task.time_needed)
    event.add("dtstart", start)  # date object → iCal VALUE=DATE
    event.add("dtend", end)
    event.add("dtstamp", datetime.now(timezone.utc))

    cal.add_component(event)
    return cal.to_ical()
```

Also remove the now-unused `timezone` import reference to timed events — keep `from datetime import datetime, timezone, timedelta` (the `timezone` is still used for `dtstamp`).

- [ ] **Step 2: Run calendar tests — verify they pass**

```bash
cd backend && uv run pytest tests/test_calendar.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 3: Run all tests**

```bash
cd backend && uv run pytest -v
```

Expected: all 8 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/services/google_calendar.py
git commit -m "feat: switch calendar sync to all-day events using start_date + time_needed"
```

---

## Task 6: Write and run migration script

**Files:**
- Create: `backend/migrate_deadline.py`

- [ ] **Step 1: Write migration script**

Create `backend/migrate_deadline.py`:
```python
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "tracker.db")


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(tasks)")
    cols = {row[1] for row in cur.fetchall()}

    if "deadline" not in cols and "start_date" in cols and "time_needed" in cols:
        print("Migration already applied, skipping.")
        conn.close()
        return

    if "start_date" not in cols:
        cur.execute("ALTER TABLE tasks ADD COLUMN start_date TEXT")
    if "time_needed" not in cols:
        cur.execute("ALTER TABLE tasks ADD COLUMN time_needed INTEGER NOT NULL DEFAULT 1")

    if "deadline" in cols:
        cur.execute(
            "UPDATE tasks SET start_date = DATE(deadline) WHERE deadline IS NOT NULL AND start_date IS NULL"
        )

    cur.execute("""
        CREATE TABLE tasks_new (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL REFERENCES goals(id),
            title TEXT NOT NULL,
            description TEXT,
            start_date TEXT,
            time_needed INTEGER NOT NULL DEFAULT 1,
            time_spent INTEGER DEFAULT 0,
            criticality TEXT NOT NULL DEFAULT 'medium',
            state TEXT NOT NULL DEFAULT 'pending',
            google_calendar_event_id TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )
    """)
    cur.execute("""
        INSERT INTO tasks_new
            (id, goal_id, title, description, start_date, time_needed,
             time_spent, criticality, state, google_calendar_event_id,
             created_at, updated_at)
        SELECT
            id, goal_id, title, description, start_date, time_needed,
            time_spent, criticality, state, google_calendar_event_id,
            created_at, updated_at
        FROM tasks
    """)
    cur.execute("DROP TABLE tasks")
    cur.execute("ALTER TABLE tasks_new RENAME TO tasks")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    run()
```

- [ ] **Step 2: Run the migration**

```bash
cd backend && uv run python migrate_deadline.py
```

Expected output: `Migration complete.` (or `Migration already applied, skipping.` if run twice).

- [ ] **Step 3: Verify schema**

```bash
cd backend && uv run python -c "
import sqlite3
conn = sqlite3.connect('tracker.db')
conn.execute('PRAGMA table_info(tasks)').fetchall()
cols = [r[1] for r in conn.execute('PRAGMA table_info(tasks)').fetchall()]
print('Columns:', cols)
assert 'deadline' not in cols, 'deadline still present!'
assert 'start_date' in cols
assert 'time_needed' in cols
print('OK')
"
```

Expected: prints column list with `start_date` and `time_needed`, no `deadline`, ends with `OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/migrate_deadline.py
git commit -m "feat: add migration script to replace deadline with start_date + time_needed"
```

---

## Task 7: Update frontend types

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Step 1: Update Task interface**

In `frontend/src/lib/types.ts`, replace the `Task` interface:
```typescript
export interface Task {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  start_date: string | null;   // ISO date YYYY-MM-DD
  time_needed: number;
  time_spent: number;
  criticality: Criticality;
  state: TaskState;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd frontend && bun tsc --noEmit
```

Expected: errors in `TaskForm.tsx` and `TaskCard.tsx` referencing `deadline` — these will be fixed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat: update Task type — swap deadline for start_date + time_needed"
```

---

## Task 8: Update TaskForm

**Files:**
- Modify: `frontend/src/components/tasks/TaskForm.tsx`

- [ ] **Step 1: Rewrite TaskForm.tsx**

Replace the entire content of `frontend/src/components/tasks/TaskForm.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { Goal, Task } from "@/lib/types";

interface Props {
  goals: Goal[];
  initial?: Partial<Task>;
  onSubmit: (data: Omit<Task, "id" | "google_calendar_event_id" | "created_at" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}

export default function TaskForm({ goals, initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    goal_id: initial?.goal_id ?? (goals[0]?.id ?? ""),
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    start_date: initial?.start_date ?? "",
    time_needed: initial?.time_needed ?? 1,
    time_spent: initial?.time_spent ?? 0,
    criticality: initial?.criticality ?? "medium",
    state: initial?.state ?? "pending",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        start_date: form.start_date || null,
        time_needed: Number(form.time_needed),
        time_spent: Number(form.time_spent),
      } as Omit<Task, "id" | "google_calendar_event_id" | "created_at" | "updated_at">);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
        <select
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.goal_id}
          onChange={(e) => set("goal_id", e.target.value)}
        >
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Days needed</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.time_needed}
            onChange={(e) => set("time_needed", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Spent (min)</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.time_spent}
            onChange={(e) => set("time_spent", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.criticality}
            onChange={(e) => set("criticality", e.target.value)}
          >
            {["low", "medium", "high", "critical"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.state}
          onChange={(e) => set("state", e.target.value)}
        >
          {["pending", "onhold", "cancelled", "done"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Check TypeScript**

```bash
cd frontend && bun tsc --noEmit
```

Expected: only errors in `TaskCard.tsx` remain (still references `deadline`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tasks/TaskForm.tsx
git commit -m "feat: replace deadline picker with start_date + days-needed inputs in TaskForm"
```

---

## Task 9: Update TaskCard

**Files:**
- Modify: `frontend/src/components/tasks/TaskCard.tsx`

- [ ] **Step 1: Rewrite TaskCard.tsx**

Replace the entire content of `frontend/src/components/tasks/TaskCard.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { Goal, Task } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import TaskForm from "./TaskForm";
import { Pencil, Trash2, Clock, Calendar } from "lucide-react";
import { updateTask, deleteTask } from "@/lib/api";

interface Props {
  task: Task;
  goals: Goal[];
  onUpdate: (t: Task) => void;
  onDelete: (id: string) => void;
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDateRange(start_date: string | null, time_needed: number): string {
  if (!start_date) return "No schedule";
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  // Parse as local date to avoid timezone shifts
  const [y, mo, d] = start_date.split("-").map(Number);
  const start = new Date(y, mo - 1, d);
  if (time_needed === 1) return fmt(start);
  const end = new Date(y, mo - 1, d + time_needed - 1);  // inclusive last day
  return `${fmt(start)} → ${fmt(end)}`;
}

export default function TaskCard({ task, goals, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);

  const handleUpdate = async (data: Omit<Task, "id" | "google_calendar_event_id" | "created_at" | "updated_at">) => {
    const updated = await updateTask(task.id, data);
    onUpdate(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    await deleteTask(task.id);
    onDelete(task.id);
  };

  const goal = goals.find((g) => g.id === task.goal_id);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm leading-tight">{task.title}</p>
            {goal && <p className="text-xs text-indigo-500 mt-0.5">↳ {goal.title}</p>}
            {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <Pencil size={13} />
            </button>
            <button onClick={handleDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <Badge variant="task-state" value={task.state} />
          <Badge variant="criticality" value={task.criticality} />
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={11} />
            {formatDateRange(task.start_date, task.time_needed)}
          </span>
          {task.time_spent > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              {formatTime(task.time_spent)}
            </span>
          )}
        </div>
      </div>

      {editing && (
        <Modal title="Edit Task" onClose={() => setEditing(false)}>
          <TaskForm goals={goals} initial={task} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </Modal>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd frontend && bun tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Build to confirm no compile errors**

```bash
cd frontend && bun run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/tasks/TaskCard.tsx
git commit -m "feat: update TaskCard to show start_date + time_needed date range"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && uv run pytest -v
```

Expected: all 8 tests PASS.

- [ ] **Step 2: Start backend and smoke-test**

```bash
cd backend && uv run uvicorn main:app --reload
```

In a second terminal:
```bash
# Get a goal id first
curl -s http://localhost:8000/api/goals | python3 -m json.tool

# Create a task (replace GOAL_ID)
curl -s -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"goal_id":"GOAL_ID","title":"Test task","start_date":"2026-05-28","time_needed":3}' | python3 -m json.tool
```

Expected: response has `start_date: "2026-05-28"`, `time_needed: 3`, no `deadline` key.

- [ ] **Step 3: Start frontend and verify form**

```bash
cd frontend && bun dev
```

Open `http://localhost:3000/tasks`, create a task — verify "Start Date" date picker and "Days needed" number input appear instead of "Deadline".

- [ ] **Step 4: Final commit if everything looks good**

```bash
git add -A && git commit -m "chore: final wiring — start_date + time_needed feature complete"
```
