# Copilot instructions — <MY>SPACE Desktop Web App

Targeted guidance for AI coding agents working on spaces-web-app. Keep
suggestions concrete and tied to actual files and patterns.

## Big-picture architecture

- Backend: Flask app factory in `app.py` (`create_app`). It serves the
  Jinja templates in `templates/` and a small JSON API. Desktop items are
  persisted in `data/desktop_items.json` with atomic saves (temp file +
  rename) under a lock. There is no database, no auth, and no session use.
- Frontend: exactly one script, `static/js/desktop.js` — global functions
  plus inline handlers in `templates/index.html`. There is no component
  system; do not reintroduce one. Windows, drag-and-drop, the folder modal,
  the start menu, and the simulated terminal all live in that file.
- Data: icon positions are stored per item (`x`, `y` in pixels). The
  template renders each icon at its stored position; dragging posts the
  new position. Do not re-add a layout pass that overwrites stored
  positions on load. Sort by Name is the only operation that repositions
  icons, and it persists each new position through the move API.

## Key workflows and dev commands

- Run the dev server: `python app.py`. It listens on `127.0.0.1:5001` by
  default; override with `HOST`/`PORT` in the environment or a `.env` file
  (see `.env.example`). Debug mode comes from `FLASK_DEBUG`, never from a
  hardcoded flag.
- Rebuild CSS: `npm run build-css` (one shot) or `npm run build-css:watch`.
  `static/css/output.css` is committed, so rebuild and commit it whenever
  templates, JavaScript, or `static/css/input.css` change. CI fails if the
  committed CSS is stale.
- Build the static preview: `npm run build` (CSS + `python freeze.py`).
  Only the index page and one example folder view are frozen; the JSON API
  is excluded by `with_no_argument_rules=False` in `freeze.py`.
- Test: `pytest` (from the repo root). Lint: `ruff check .`. JS syntax:
  `node --check static/js/desktop.js`.

## Patterns and conventions to follow

- Validate API payloads in `app.py` before touching the data file: a
  rejected request must return `400` and leave the file unchanged. Keep
  the `_is_number` / `_validate_item` helpers in sync with any new fields.
- Keep the `desktop_items.json` shape (`id`, `name`, `type`, `icon`, `x`,
  `y`) backward compatible unless changing the template, the API, and
  `tests/test_app.py` together.
- Escape item-derived text with the `escapeHtml` helper in `desktop.js`
  before interpolating it into window markup, and use `textContent` for
  user-facing labels. Never put raw user input into `innerHTML`.
- Use Tailwind utility classes for small UI changes; larger custom rules
  go in `static/css/input.css`, never in a second stylesheet.
- Folder contents, the calculator, the browser window, and settings are
  visual demos with fixed mock content. Say so in the README if a change
  touches them; do not present mock behavior as real functionality.
- No external requests at runtime: no CDN scripts, fonts, or avatar URLs.
  If a proposed change needs one, it needs an explicit decision first.

## Important integration points

- API endpoints used by `desktop.js`: `GET /api/items`,
  `POST /api/items` (`{"name", "type"}` → `201`),
  `POST /api/items/<id>/move` (`{"x", "y"}` → `{"success": true}`), and
  `GET /api/time`. The clock polls `/api/time` every second.
- The full-page folder view (`GET /folder/<path>`) serves fixed demo
  contents from `FOLDER_CONTENTS` in `app.py`; the in-desktop folder modal
  uses separate fixed mock data in `getFolderContents` in `desktop.js`.
  Keep both labeled as demos.

## Where to put tests

- Backend tests go in `tests/test_app.py` with pytest, using `create_app`
  with a temporary data file. Cover the happy path, the `400` cases, and
  the "file unchanged on rejection" property for any new write endpoint.
- The freeze-excludes-API test in `tests/test_app.py` guards the static
  preview contract; keep it passing if `freeze.py` changes.

## Examples of project-specific tasks

- Add a new app: add a start-menu tile in `templates/index.html` and a
  `case` in `getWindowContent` in `static/js/desktop.js`.
- Persist a new item field: update `_validate_item` and the create/move
  handlers in `app.py`, the template rendering in `templates/index.html`,
  and the tests — in one change.

## When suggesting code changes

- Reference exact files, e.g. "Add a route to `app.py`" rather than a
  generic "add API".
- Prefer the smallest change that keeps the existing single-script
  frontend and the validated API contract intact.
