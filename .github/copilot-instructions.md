<!-- Copilot/AI agent instructions for the "neo" project -->
# Project snapshot

This is a small single-page ordering app with a Python/Flask backend and a Bootstrap/JS frontend.

- Backend: [app.py](app.py) — Flask app, serves `index.html` as static root and exposes REST APIs under `/api/*`.
- Frontend: [index.html](index.html) + [assets/js/app.js](assets/js/app.js) — SPA-style UI that calls the backend with relative fetches.
- DB: `inventario.db` (SQLite, auto-initialized by `setup_database()` inside `app.py`).
- Static libs: [assets/lib](assets/lib) contains `jspdf` and `xlsx` used for client exports.

# Big-picture architecture and data flow

- The Flask process in `app.py` serves static files (static_folder='.') and provides API endpoints such as:
  - `GET /api/proveedores` (mesas/puntos de venta)
  - `GET /api/categorias`
  - `GET /api/articulos`
  - `GET|POST /api/pedidos`
  - `GET /api/exportar/pedidos` (CSV export)

- The frontend uses `window.location.origin + '/api/'` (see `assets/js/app.js`) so all requests are origin-relative — avoid hardcoding hostnames.
- Frontend data flow: load proveedores -> categorias -> articulos -> render UI -> create pedidos -> POST `/api/pedidos`.

# Important code patterns & conventions (project-specific)

- Spanish variable names and comments are used across the codebase (e.g. `mesa`, `pedido`, `articulos`). Keep messages and UI text language-consistent.
- Currency is shown as `S/` in the UI; prices are stored as `precio` (float) in the `articulos` table.
- Providers (`proveedores`) are used as tables/points-of-sale (e.g. "Mesa 1"). Treat them as venues rather than remote supplier entities.
- Database initialization runs at import time via `setup_database()` in `app.py`. Tests or code that import `app` will create `inventario.db` if missing.
- CORS is enabled only for `/api/*` (see `CORS(app, resources={r"/api/*": ...})`). Be careful when adding new endpoints outside `/api/`.

# Editing guidance & common edits

- To add a new API: update `app.py`, follow the existing pattern (use `get_db_connection()` and `conn.commit()`), and add matching frontend fetch in `assets/js/app.js`.
- To change frontend behavior: edit `assets/js/app.js`. It contains global functions bound to `window` (e.g. `seleccionarMesa`, `agregarAlCarrito`) used directly from inline onclick handlers in `index.html`.
- Avoid changing Flask's `static_folder='.'` unless you update how `index.html` and static assets are served.

# Local development & run commands

- Run locally (development):

  - On Windows / local: `python app.py`
  - To pick a custom port: `set PORT=8080` (PowerShell: `$env:PORT=8080`) then `python app.py`.

- Notes: `app.py` uses `host='0.0.0.0'` and reads `PORT` from env — this is intentional for services like Render.

# Integration points & external libs

- Client-side libs: Chart.js (CDN), Bootstrap (CDN), Font Awesome (CDN), local `assets/lib/jspdf.min.js` and `xlsx.full.min.js`.
- Server-side: standard Python stdlib + `flask`, `flask_cors`, `sqlite3` — no requirements file exists; add `requirements.txt` if needed.

# What to look out for when modifying code

- SQL strings are hand-written (no ORM). Keep parameterized queries (`?`) to avoid SQL injection.
- `setup_database()` seeds categories and mesas; removing or renaming seeded IDs will affect frontend category buttons.
- Frontend uses optimistic UI (alerts + immediate refresh) — server errors are often caught and shown as alerts or console logs.

# Quick-reference examples

- Where backend constructs an order (POST): [app.py](app.py) — `@app.route('/api/pedidos', methods=['GET','POST'])`.
- Where frontend posts an order: [assets/js/app.js](assets/js/app.js) — `fetch(`${PYTHON_SERVER_URL}pedidos`, { method: 'POST', ... })`.

# If you need more context

- Open and read these files first: [app.py](app.py), [index.html](index.html), [assets/js/app.js](assets/js/app.js).
- Ask if you want the repository to include a `requirements.txt`, run scripts, or CI steps — I can add them and update these instructions.

---
Please review these notes and tell me if you'd like more detail on deployment, automated tests, or a stricter lint/format setup.
