import os
from importlib import reload
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ["KARETA_DATABASE"] = "sqlite:///./test_kareta.db"

from backend import database  # noqa: E402

reload(database)

from backend.database import Base, engine  # noqa: E402
from backend import main  # noqa: E402

reload(main)

from backend.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_program_crud():
    program_payload = {
        "name": "Программирование",
        "duration_months": 36,
        "description": "Разработка программного обеспечения",
    }

    response = client.post("/programs", json=program_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == program_payload["name"]

    list_response = client.get("/programs")
    assert list_response.status_code == 200
    programs = list_response.json()
    assert len(programs) == 1
    assert programs[0]["duration_months"] == 36


def test_lead_conversion_flow():
    program = client.post(
        "/programs",
        json={
            "name": "Техническое обслуживание",
            "duration_months": 24,
            "description": "Практико-ориентированная программа",
        },
    ).json()

    lead_payload = {
        "name": "Иван Петров",
        "email": "ivan@example.com",
        "phone": "+7 900 111-22-33",
        "preferred_program_id": program["id"],
        "notes": "Интересуется вечерним отделением",
    }
    lead = client.post("/leads", json=lead_payload)
    assert lead.status_code == 201

    convert_payload = {
        "first_name": "Иван",
        "last_name": "Петров",
        "email": "ivan@example.com",
        "phone": "+7 900 111-22-33",
        "program_id": program["id"],
        "status": "enrolled",
    }
    convert_response = client.post(f"/leads/{lead.json()['id']}/convert", json=convert_payload)
    assert convert_response.status_code == 200
    student = convert_response.json()
    assert student["program"]["name"] == program["name"]

    lead_detail = client.get("/leads").json()[0]
    assert lead_detail["status"] == "converted"
    assert lead_detail["converted_student_id"] == student["id"]


def test_dashboard_summary_counts():
    client.post(
        "/programs",
        json={
            "name": "Транспортные системы",
            "duration_months": 36,
            "description": "Подготовка специалистов по логистике",
        },
    )

    client.post(
        "/leads",
        json={
            "name": "Мария Кузнецова",
            "email": "maria@example.com",
            "phone": None,
            "notes": None,
        },
    )

    summary = client.get("/dashboard/summary")
    assert summary.status_code == 200
    data = summary.json()
    assert data["programs"] == 1
    assert data["leads"] == 1
    assert data["new_leads"] == 1


@pytest.fixture(scope="session", autouse=True)
def cleanup_db_file():
    yield
    db_path = Path('test_kareta.db')
    if db_path.exists():
        db_path.unlink()
