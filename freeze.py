"""Freeze the app to a static preview in ``build/``.

Only the index page and one example folder view are frozen. The JSON API
is deliberately excluded (``with_no_argument_rules=False``): in a static
preview, drag-to-move and new-folder persistence have no server to talk
to. ``static/css/output.css`` is a committed build artifact and must exist
before freezing; run ``npm run build-css`` to regenerate it.
"""

import os

from flask_frozen import Freezer

from app import create_app

app = create_app()
freezer = Freezer(app, with_no_argument_rules=False)


@freezer.register_generator
def index():
    yield {}


@freezer.register_generator
def folder_view():
    yield {"folder_path": "Documents"}


if __name__ == "__main__":
    css_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "static", "css", "output.css"
    )
    if not os.path.exists(css_path):
        raise SystemExit(
            "static/css/output.css is missing; run `npm run build-css` first."
        )
    freezer.freeze()
