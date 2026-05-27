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
