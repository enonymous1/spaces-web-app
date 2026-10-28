import json
import shutil
from pathlib import Path

import pytest
from flask_frozen import Freezer

from app import create_app

ITEMS = [
    {"id": 1, "name": "Documents", "type": "folder", "icon": "folder", "x": 99, "y": 138},
    {"id": 2, "name": "Pictures", "type": "folder", "icon": "folder", "x": 419, "y": 293},
    {"id": 3, "name": "Terminal", "type": "app", "icon": "terminal", "x": 109, "y": 294},
    {"id": 4, "name": "Text Editor", "type": "app", "icon": "document-text", "x": 412, "y": 81},
]


@pytest.fixture()
def data_file(tmp_path):
    path = tmp_path / "desktop_items.json"
    path.write_text(json.dumps(ITEMS, indent=2), encoding="utf-8")
    return str(path)


@pytest.fixture()
def client(data_file):
    app = create_app(data_file=data_file)
    app.config["TESTING"] = True
    # Return 500 responses for bad data instead of re-raising, as in production.
    app.config["PROPAGATE_EXCEPTIONS"] = False
    return app.test_client()


def _read_bytes(data_file):
    return Path(data_file).read_bytes()


def _read_items(data_file):
    with open(data_file, encoding="utf-8") as handle:
        return json.load(handle)


def test_index_renders_items_at_stored_positions(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.get_data(as_text=True)
    assert "Documents" in body
    assert "left: 99px; top: 138px;" in body
    assert "css/output.css" in body
    assert "js/components/" not in body
    assert "css/style.css" not in body


def test_index_has_no_external_requests(client):
    body = client.get("/").get_data(as_text=True)
    assert "https://" not in body
    assert "http://" not in body


def test_get_items(client):
    response = client.get("/api/items")
    assert response.status_code == 200
    assert response.get_json() == ITEMS


def test_get_time_shape(client):
    payload = client.get("/api/time").get_json()
    assert payload["time"]
    assert payload["date"]


def test_move_persists(client, data_file):
    response = client.post("/api/items/1/move", json={"x": 10, "y": 20})
    assert response.status_code == 200
    assert response.get_json() == {"success": True}
    assert _read_items(data_file)[0]["x"] == 10
    assert _read_items(data_file)[0]["y"] == 20
    assert client.get("/api/items").get_json()[0]["x"] == 10


def test_move_rejects_empty_object_without_touching_file(client, data_file):
    before = _read_bytes(data_file)
    response = client.post("/api/items/1/move", json={})
    assert response.status_code == 400
    assert _read_bytes(data_file) == before


@pytest.mark.parametrize("payload", [{"x": "10", "y": 20}, {"x": True, "y": 20}, {"x": None, "y": 20}])
def test_move_rejects_non_numeric_coordinates(client, data_file, payload):
    before = _read_bytes(data_file)
    response = client.post("/api/items/1/move", json=payload)
    assert response.status_code == 400
    assert _read_bytes(data_file) == before


def test_move_rejects_missing_json_body(client, data_file):
    before = _read_bytes(data_file)
    response = client.post("/api/items/1/move")
    assert response.status_code == 400
    assert _read_bytes(data_file) == before


def test_move_missing_item_is_404(client):
    response = client.post("/api/items/99/move", json={"x": 1, "y": 1})
    assert response.status_code == 404


def test_create_folder_persists(client, data_file):
    response = client.post("/api/items", json={"name": "New Folder", "type": "folder"})
    assert response.status_code == 201
    item = response.get_json()
    assert item["id"] == 5
    assert item["icon"] == "folder"
    assert len(_read_items(data_file)) == 5
    assert client.get("/api/items").get_json()[-1]["name"] == "New Folder"


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "", "type": "folder"},
        {"name": "   ", "type": "folder"},
        {"name": "x" * 51, "type": "folder"},
        {"name": "Ok", "type": "file"},
        {"name": 42, "type": "folder"},
    ],
)
def test_create_rejects_bad_payloads(client, data_file, payload):
    before = _read_bytes(data_file)
    response = client.post("/api/items", json=payload)
    assert response.status_code == 400
    assert _read_bytes(data_file) == before


def test_folder_view_is_demo_content(client):
    response = client.get("/folder/Documents")
    assert response.status_code == 200
    body = response.get_data(as_text=True)
    assert "Document 1.txt" in body
    assert "Demo contents" in body
    assert "cdn.tailwindcss.com" not in body
    assert "css/output.css" in body


def test_corrupt_data_file_fails_loud(client, data_file):
    with open(data_file, "w", encoding="utf-8") as handle:
        handle.write("{not json")
    assert client.get("/api/items").status_code == 500


def test_invalid_item_shape_fails_loud(client, data_file):
    bad = [dict(ITEMS[0], x="left")]
    with open(data_file, "w", encoding="utf-8") as handle:
        json.dump(bad, handle)
    assert client.get("/api/items").status_code == 500


def test_freeze_excludes_api_routes(tmp_path, data_file):
    app = create_app(data_file=data_file)
    app.config["FREEZER_DESTINATION"] = str(tmp_path / "build")
    freezer = Freezer(app, with_no_argument_rules=False)

    @freezer.register_generator
    def index():
        yield {}

    @freezer.register_generator
    def folder_view():
        yield {"folder_path": "Documents"}

    freezer.freeze()
    build = tmp_path / "build"
    assert (build / "index.html").exists()
    assert (build / "folder" / "Documents").is_file()
    assert not (build / "api").exists()
    assert "js/components/" not in (build / "index.html").read_text(encoding="utf-8")
    shutil.rmtree(build, ignore_errors=True)
