# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Study Tracker: FastAPI + SQLite backend (`backend/`), React 19 + TypeScript + Vite + Tailwind v4 frontend (`frontend/`). No tests configured on either side.

## Commands

Backend (run from `backend/`; imports are flat, e.g. `import database`, so cwd must be `backend/`):
- Venv at `backend/venv` (Windows): `venv\Scripts\Activate.ps1`
- Install: `pip install -r requirements.txt` (file is UTF-16 encoded)
- Run: `uvicorn main:app --reload` (serves on 127.0.0.1:8000)

Frontend (run from `frontend/`):
- `npm run dev` (Vite, port 5173)
- `npm run build` (`tsc -b && vite build`)
- `npm run lint`

## Architecture

- `backend/models.py`: SQLAlchemy models `Subject`, `Session`, `Deadline` (sessions/deadlines FK to subject). `backend/schemas.py`: Pydantic `*Create` / `*Out` schemas.
- `backend/database.py`: SQLite file `study_tracker.db` created in cwd; `Base.metadata.create_all` runs at import (no migrations). `get_db` is the FastAPI dependency.
- `backend/main.py`: all routes in one file. For `/subjects/`, `/sessions/`, `/deadlines/`: POST, GET list, `PUT /{id}` (full replace, takes the `*Create` schema), `DELETE /{id}` (204, 404 if missing). PUT/DELETE share helpers `_update` / `_delete`.
- Deleting a `Subject` cascades to its sessions and deadlines (`cascade="all, delete-orphan"` in `models.py`).
- CORS allows only `http://localhost:5173`. The frontend hardcodes `http://127.0.0.1:8000` in `frontend/src/api/client.ts`; change both if ports/hosts change.
- Frontend: `App.tsx` owns `refreshKey`, the subjects list and the active tab (subjects / sessions / deadlines). `Overview` (weekly hours per subject vs `target_hours_per_week`, week starts Monday) is always shown; the tab content is `SubjectForm`/`SubjectList`, `SessionPanel` or `DeadlinePanel`. Components refetch when `refreshKey` changes. Subject and session mutations call `onChanged` to bump it (so `Overview` stays in sync); `DeadlinePanel` reloads itself. Shared Tailwind component classes (`card`, `field`, `btn`, `btn-icon`, `row`, `empty`) live in `src/index.css`; `App.css` is unused. All API calls go through the `request<T>` helper in `src/api/client.ts`; shared types in `src/types/index.ts`. Tailwind loaded via `@tailwindcss/vite` plugin.
