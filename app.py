"""<MY>SPACE desktop web app.

A Flask app that serves a desktop-like interface in the browser. Desktop
icon positions are persisted in ``data/desktop_items.json``; the folder
view and the in-window apps are visual demos with fixed mock content.
"""

import json
import math
import os
import tempfile
import threading
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

_SAVE_LOCK = threading.Lock()

FOLDER_CONTENTS = [
    {"name": "Document 1.txt", "type": "file", "icon": "document"},
    {"name": "Image.jpg", "type": "file", "icon": "photograph"},
    {"name": "Subfolder", "type": "folder", "icon": "folder"},
]

_DEFAULT_ICONS = {"folder": "folder", "app": "document-text"}


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    DEBUG = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    DATA_FILE = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "data", "desktop_items.json"
    )


def _is_number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _validate_item(item):
    if not isinstance(item, dict):
        raise TypeError("desktop item must be an object")
    if not isinstance(item.get("id"), int) or isinstance(item.get("id"), bool):
        raise TypeError("desktop item id must be an integer")
    if not isinstance(item.get("name"), str):
        raise TypeError("desktop item name must be a string")
    if not item["name"].strip():
        raise ValueError("desktop item name must be a non-empty string")
    if item.get("type") not in {"folder", "app"}:
        raise ValueError("desktop item type must be 'folder' or 'app'")
    if not isinstance(item.get("icon"), str):
        raise TypeError("desktop item icon must be a string")
    if not item["icon"]:
        raise ValueError("desktop item icon must be a non-empty string")
    if not _is_number(item.get("x")) or not _is_number(item.get("y")):
        raise TypeError("desktop item x and y must be finite numbers")


def load_desktop_items(data_file):
    """Load and validate the desktop items file. Fail loud on bad data."""
    with open(data_file, encoding="utf-8") as handle:
        items = json.load(handle)
    if not isinstance(items, list):
        raise TypeError("desktop items file must contain a JSON array")
    for item in items:
        _validate_item(item)
    return items


def save_desktop_items(data_file, items):
    """Persist items atomically so a crash cannot leave a torn JSON file."""
    directory = os.path.dirname(data_file)
    with _SAVE_LOCK:
        fd, tmp_path = tempfile.mkstemp(dir=directory, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(items, handle, indent=2)
                handle.write("\n")
            os.replace(tmp_path, data_file)
        except BaseException:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise


def create_app(config=None, data_file=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config:
        app.config.update(config)
    if data_file is not None:
        app.config["DATA_FILE"] = data_file

    def data_file_path():
        return app.config["DATA_FILE"]

    @app.route("/")
    def index():
        """Main desktop view."""
        items = load_desktop_items(data_file_path())
        return render_template("index.html", items=items)

    @app.route("/api/items")
    def get_items():
        """Return the desktop items."""
        return jsonify(load_desktop_items(data_file_path()))

    @app.route("/api/items", methods=["POST"])
    def create_item():
        """Create a desktop item. Body: {"name": str, "type": "folder"|"app"}."""
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "JSON object with name and type required"}), 400
        name = payload.get("name")
        item_type = payload.get("type")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 50:
            return jsonify({"error": "name must be a non-empty string"}), 400
        if item_type not in {"folder", "app"}:
            return jsonify({"error": "type must be 'folder' or 'app'"}), 400
        items = load_desktop_items(data_file_path())
        next_id = max((item["id"] for item in items), default=0) + 1
        item = {
            "id": next_id,
            "name": name.strip(),
            "type": item_type,
            "icon": _DEFAULT_ICONS[item_type],
            "x": 24,
            "y": 24,
        }
        items.append(item)
        save_desktop_items(data_file_path(), items)
        return jsonify(item), 201

    @app.route("/api/items/<int:item_id>/move", methods=["POST"])
    def move_item(item_id):
        """Move a desktop item. Body: {"x": number, "y": number}."""
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "JSON object with numeric x and y required"}), 400
        x, y = payload.get("x"), payload.get("y")
        if not _is_number(x) or not _is_number(y):
            return jsonify({"error": "x and y must be finite numbers"}), 400
        items = load_desktop_items(data_file_path())
        for item in items:
            if item["id"] == item_id:
                item["x"] = x
                item["y"] = y
                save_desktop_items(data_file_path(), items)
                return jsonify({"success": True})
        return jsonify({"success": False, "error": "Item not found"}), 404

    @app.route("/api/time")
    def get_time():
        """Current time/date for the taskbar clock."""
        now = datetime.now()
        return jsonify(
            {
                "time": now.strftime("%I:%M %p"),
                "date": now.strftime("%A, %B %d, %Y"),
            }
        )

    @app.route("/folder/<path:folder_path>")
    def folder_view(folder_path):
        """Full-page folder view. Contents are fixed demo data."""
        return render_template(
            "folder.html", folder_path=folder_path, contents=FOLDER_CONTENTS
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5001")),
        debug=app.config["DEBUG"],
    )
