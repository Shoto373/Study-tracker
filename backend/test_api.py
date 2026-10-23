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


def add_session(client, subject_id, day, minutes=30):
    body = {"subject_id": subject_id, "date": day, "duration_minutes": minutes}
    return client.post("/sessions/", json=body).json()


def add_deadline(client, subject_id, due, is_done=False, title="T"):
    body = {"subject_id": subject_id, "title": title, "due_date": due, "is_done": is_done}
    return client.post("/deadlines/", json=body).json()


def ids(response):
    return [x["id"] for x in response.json()]


def test_sessions_filters_and_order(client):
    a = make_subject(client).json()["id"]
    b = make_subject(client, name="Phys").json()["id"]
    s1 = add_session(client, a, "2026-01-05")
    s2 = add_session(client, a, "2026-01-07")
    s3 = add_session(client, b, "2026-01-07")
    s4 = add_session(client, a, "2026-01-09")

    assert ids(client.get("/sessions/")) == [s4["id"], s3["id"], s2["id"], s1["id"]]
    assert ids(client.get(f"/sessions/?subject_id={b}")) == [s3["id"]]
    assert ids(client.get("/sessions/?date_from=2026-01-07")) == [s4["id"], s3["id"], s2["id"]]
    assert ids(client.get("/sessions/?date_to=2026-01-07")) == [s3["id"], s2["id"], s1["id"]]
    r = client.get(f"/sessions/?subject_id={a}&date_from=2026-01-06&date_to=2026-01-08")
    assert ids(r) == [s2["id"]]


@pytest.mark.parametrize(
    "qs", ["subject_id=abc", "date_from=nope", "date_to=2026-13-01"]
)
def test_sessions_invalid_filters(client, qs):
    assert client.get(f"/sessions/?{qs}").status_code == 422


def test_deadlines_filters_and_order(client):
    a = make_subject(client).json()["id"]
    b = make_subject(client, name="Phys").json()["id"]
    d1 = add_deadline(client, a, "2026-03-01")
    d2 = add_deadline(client, b, "2026-02-01", is_done=True)
    d3 = add_deadline(client, a, "2026-02-15")

    assert ids(client.get("/deadlines/")) == [d2["id"], d3["id"], d1["id"]]
    assert ids(client.get(f"/deadlines/?subject_id={a}")) == [d3["id"], d1["id"]]
    assert ids(client.get("/deadlines/?is_done=true")) == [d2["id"]]
    assert ids(client.get("/deadlines/?is_done=false")) == [d3["id"], d1["id"]]
    assert ids(client.get("/deadlines/?due_before=2026-02-15")) == [d2["id"]]


@pytest.mark.parametrize("qs", ["is_done=maybe", "due_before=x", "subject_id=x"])
def test_deadlines_invalid_filters(client, qs):
    assert client.get(f"/deadlines/?{qs}").status_code == 422


def test_weekly_stats(client):
    a = make_subject(client).json()
    b = make_subject(client, name="Phys", color="#abcdef", target_hours_per_week=2).json()
    add_session(client, a["id"], "2026-01-04", 99)  # Sunday before, excluded
    add_session(client, a["id"], "2026-01-05", 30)
    add_session(client, a["id"], "2026-01-11", 45)  # last day, included
    add_session(client, a["id"], "2026-01-12", 99)  # next Monday, excluded

    r = client.get("/stats/weekly?week_start=2026-01-05")
    assert r.status_code == 200
    assert r.json() == [
        {"subject_id": a["id"], "name": "Math", "color": "#112233",
         "target_hours_per_week": 5, "minutes": 75},
        {"subject_id": b["id"], "name": "Phys", "color": "#abcdef",
         "target_hours_per_week": 2, "minutes": 0},
    ]


def test_weekly_stats_default_and_invalid(client):
    make_subject(client)
    r = client.get("/stats/weekly")
    assert r.status_code == 200
    assert r.json()[0]["minutes"] == 0
    assert client.get("/stats/weekly?week_start=bad").status_code == 422
