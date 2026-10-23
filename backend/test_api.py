import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database
from main import app
from models import Base


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_subject(client, **overrides):
    body = {"name": "Math", "color": "#112233", "target_hours_per_week": 5, **overrides}
    return client.post("/subjects/", json=body)


def test_subject_crud(client):
    created = make_subject(client).json()
    assert created["name"] == "Math"

    body = {"name": "Algebra", "color": "#445566", "target_hours_per_week": 3}
    updated = client.put(f"/subjects/{created['id']}", json=body).json()
    assert updated["name"] == "Algebra"

    assert client.delete(f"/subjects/{created['id']}").status_code == 204
    assert client.get("/subjects/").json() == []


def test_missing_item_returns_404(client):
    assert client.delete("/subjects/999").status_code == 404
    body = {"name": "x", "color": "#112233", "target_hours_per_week": 1}
    assert client.put("/subjects/999", json=body).status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": ""},
        {"color": "red"},
        {"target_hours_per_week": -1},
    ],
)
def test_subject_validation(client, overrides):
    assert make_subject(client, **overrides).status_code == 422


def test_session_requires_existing_subject(client):
    body = {"subject_id": 42, "date": "2026-01-05", "duration_minutes": 30}
    assert client.post("/sessions/", json=body).status_code == 404


def test_session_duration_must_be_positive(client):
    subject = make_subject(client).json()
    body = {"subject_id": subject["id"], "date": "2026-01-05", "duration_minutes": 0}
    assert client.post("/sessions/", json=body).status_code == 422


def test_deadline_toggle_done(client):
    subject = make_subject(client).json()
    body = {
        "subject_id": subject["id"],
        "title": "Homework",
        "due_date": "2026-02-01",
        "is_done": False,
    }
    deadline = client.post("/deadlines/", json=body).json()
    body["is_done"] = True
    updated = client.put(f"/deadlines/{deadline['id']}", json=body).json()
    assert updated["is_done"] is True


def test_deleting_subject_removes_its_sessions_and_deadlines(client):
    subject = make_subject(client).json()
    sid = subject["id"]
    client.post("/sessions/", json={"subject_id": sid, "date": "2026-01-05", "duration_minutes": 30})
    client.post("/deadlines/", json={"subject_id": sid, "title": "T", "due_date": "2026-02-01"})

    client.delete(f"/subjects/{sid}")

    assert client.get("/sessions/").json() == []
    assert client.get("/deadlines/").json() == []
