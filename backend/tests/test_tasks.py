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
