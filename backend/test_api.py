from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database
import scraper
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


FIXTURE = Path(__file__).parent / "fixtures" / "group_schedule.html"


def test_parse_subjects_from_real_page():
    page = FIXTURE.read_text(encoding="utf-8")
    subjects = {s["name"]: s["lessons"] for s in scraper.parse_subjects(page)}
    assert "Физика" in subjects
    # Subgroup suffixes and duplicated names are collapsed.
    assert "Иностранный язык" in subjects
    assert not any("п.г." in name or name.endswith(",") for name in subjects)


def test_parse_groups_and_faculties():
    page = FIXTURE.read_text(encoding="utf-8")
    assert {"id": 1633, "name": "5413"} in scraper.parse_groups(page)
    assert any(f["id"] == 4 for f in scraper.parse_faculties(page))


def test_import_schedule_creates_only_new_subjects(client, monkeypatch):
    monkeypatch.setattr(
        scraper,
        "fetch_subjects",
        lambda faculty, group: [{"name": "Физика", "lessons": 3}, {"name": "Math", "lessons": 1}],
    )
    make_subject(client, name="math")  # same name, other case: must not be duplicated

    result = client.post("/schedule/import", json={"faculty": 4, "group": 1633, "group_name": "5413"}).json()

    assert [s["name"] for s in result["created"]] == ["Физика"]
    assert result["created"][0]["target_hours_per_week"] == 5  # 3 lessons * 1.5h, rounded up
    assert result["existing"] == ["Math"]
    assert len(client.get("/subjects/").json()) == 2


def test_import_schedule_site_down_returns_502(client, monkeypatch):
    def boom(faculty, group):
        raise scraper.ScheduleUnavailable("down")

    monkeypatch.setattr(scraper, "fetch_subjects", boom)
    assert client.post("/schedule/import", json={"faculty": 4, "group": 1, "group_name": "x"}).status_code == 502


def stub_timetable(monkeypatch, names):
    monkeypatch.setattr(
        scraper, "fetch_subjects", lambda faculty, group: [{"name": n, "lessons": 1} for n in names]
    )


def pick_group(client, group, name, confirm=False, ip=None):
    headers = {"X-Real-IP": ip} if ip else {}
    body = {"faculty": 4, "group": group, "group_name": name, "confirm": confirm}
    return client.post("/schedule/import", json=body, headers=headers)


def test_group_is_pinned_to_ip(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика"])
    assert client.get("/schedule/me").json() is None

    pick_group(client, 1633, "5413")

    assert client.get("/schedule/me").json() == {"faculty": 4, "group": 1633, "group_name": "5413"}
    other = client.get("/schedule/me", headers={"X-Real-IP": "10.0.0.2"})
    assert other.json() is None


def test_data_is_separate_per_ip(client):
    a = {"X-Real-IP": "10.0.0.1"}
    b = {"X-Real-IP": "10.0.0.2"}
    body = {"name": "Math", "color": "#112233", "target_hours_per_week": 1}
    subject = client.post("/subjects/", json=body, headers=a).json()

    assert client.get("/subjects/", headers=b).json() == []
    assert client.delete(f"/subjects/{subject['id']}", headers=b).status_code == 404
    session = {"subject_id": subject["id"], "date": "2026-01-05", "duration_minutes": 30}
    assert client.post("/sessions/", json=session, headers=b).status_code == 404
    assert len(client.get("/subjects/", headers=a).json()) == 1


def test_changing_group_replaces_subjects_when_no_activity(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика", "Химия"])
    pick_group(client, 1633, "5413")
    stub_timetable(monkeypatch, ["История"])

    result = pick_group(client, 1634, "5413А").json()

    assert result["replaced"] is True
    assert [s["name"] for s in client.get("/subjects/").json()] == ["История"]
    assert client.get("/schedule/me").json()["group"] == 1634


def test_changing_group_with_activity_needs_confirmation(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика"])
    created = pick_group(client, 1633, "5413").json()["created"][0]
    session = {"subject_id": created["id"], "date": "2026-01-05", "duration_minutes": 45}
    client.post("/sessions/", json=session)
    stub_timetable(monkeypatch, ["История"])

    refused = pick_group(client, 1634, "5413А")

    assert refused.status_code == 409
    assert refused.json()["detail"] == {"code": "has_activity", "sessions": 1, "minutes": 45}
    # Nothing changed.
    assert [s["name"] for s in client.get("/subjects/").json()] == ["Физика"]
    assert len(client.get("/sessions/").json()) == 1
    assert client.get("/schedule/me").json()["group"] == 1633

    confirmed = pick_group(client, 1634, "5413А", confirm=True)

    assert confirmed.status_code == 200
    assert [s["name"] for s in client.get("/subjects/").json()] == ["История"]
    assert client.get("/sessions/").json() == []


def test_reselecting_same_group_never_wipes_anything(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика"])
    created = pick_group(client, 1633, "5413").json()["created"][0]
    session = {"subject_id": created["id"], "date": "2026-01-05", "duration_minutes": 45}
    client.post("/sessions/", json=session)

    again = pick_group(client, 1633, "5413")

    assert again.status_code == 200
    assert again.json()["replaced"] is False
    assert len(client.get("/sessions/").json()) == 1


def test_site_failure_does_not_wipe_subjects(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика"])
    pick_group(client, 1633, "5413")

    def boom(faculty, group):
        raise scraper.ScheduleUnavailable("down")

    monkeypatch.setattr(scraper, "fetch_subjects", boom)

    assert pick_group(client, 1634, "5413А").status_code == 502
    assert [s["name"] for s in client.get("/subjects/").json()] == ["Физика"]
    assert client.get("/schedule/me").json()["group"] == 1633


def test_delete_all_subjects_clears_data_and_unpins_group(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика", "Химия"])
    created = pick_group(client, 1633, "5413").json()["created"][0]
    client.post("/sessions/", json={"subject_id": created["id"], "date": "2026-01-05", "duration_minutes": 30})
    other = {"X-Real-IP": "10.0.0.2"}
    client.post("/subjects/", json={"name": "Чужой", "color": "#112233", "target_hours_per_week": 1}, headers=other)

    assert client.delete("/subjects/").status_code == 204

    assert client.get("/subjects/").json() == []
    assert client.get("/sessions/").json() == []
    assert client.get("/schedule/me").json() is None
    # Another owner's data is untouched.
    assert len(client.get("/subjects/", headers=other).json()) == 1


def test_deleted_group_subject_is_not_restored_by_import(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика", "Химия"])
    created = pick_group(client, 1633, "5413").json()["created"]
    physics = next(s for s in created if s["name"] == "Физика")

    client.delete(f"/subjects/{physics['id']}")
    result = pick_group(client, 1633, "5413").json()  # what a page reload triggers

    assert result["created"] == []
    assert [s["name"] for s in client.get("/subjects/").json()] == ["Химия"]


def test_custom_edits_survive_import(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика", "Химия"])
    created = pick_group(client, 1633, "5413").json()["created"]
    chem = next(s for s in created if s["name"] == "Химия")
    client.put(f"/subjects/{chem['id']}", json={"name": "Моя химия", "color": "#abcdef", "target_hours_per_week": 9})
    client.post("/subjects/", json={"name": "Гитара", "color": "#112233", "target_hours_per_week": 2})

    result = pick_group(client, 1633, "5413").json()

    assert result["created"] == []  # renamed subject is not re-added under its timetable name
    by_name = {s["name"]: s for s in client.get("/subjects/").json()}
    assert set(by_name) == {"Физика", "Моя химия", "Гитара"}
    assert by_name["Моя химия"]["target_hours_per_week"] == 9


def test_changing_group_forgets_dismissed_subjects(client, monkeypatch):
    stub_timetable(monkeypatch, ["Физика"])
    created = pick_group(client, 1633, "5413").json()["created"][0]
    client.delete(f"/subjects/{created['id']}")

    # Another group that also has "Физика": the removal belonged to the old group.
    pick_group(client, 1634, "5413А")

    assert [s["name"] for s in client.get("/subjects/").json()] == ["Физика"]


def test_fetch_subjects_averages_over_numerator_and_denominator_weeks(monkeypatch):
    weeks = [
        [{"name": "A", "lessons": 2}, {"name": "B", "lessons": 1}],  # numerator week
        [{"name": "A", "lessons": 2}],  # denominator week: no B
        [],  # timetable ended
        [{"name": "Late", "lessons": 1}],  # must not be read
    ]
    pages = iter(range(len(weeks)))
    state = {}

    def fake_fetch(params):
        state["week"] = next(pages)
        return ""

    monkeypatch.setattr(scraper, "_fetch", fake_fetch)
    monkeypatch.setattr(scraper, "parse_subjects", lambda page: weeks[state["week"]])

    result = {s["name"]: s["lessons"] for s in scraper.fetch_subjects(4, 1633)}

    assert result == {"A": 2.0, "B": 0.5}


def test_import_target_hours_use_weekly_average(client, monkeypatch):
    monkeypatch.setattr(
        scraper, "fetch_subjects", lambda f, g: [{"name": "Каждую неделю", "lessons": 2.0}, {"name": "Через неделю", "lessons": 0.5}]
    )
    result = pick_group(client, 1633, "5413").json()
    hours = {s["name"]: s["target_hours_per_week"] for s in result["created"]}
    assert hours == {"Каждую неделю": 3, "Через неделю": 1}
