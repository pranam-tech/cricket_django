# CricTracker: Professional Cricket Scoring Platform

A full-stack cricket scoring platform built with Django + React for tournament management, live scoring, and role-based operations.

## Tech Stack

- Backend: Django, Django REST Framework, Token auth
- Frontend: React (Vite), React Router, Axios
- Database: PostgreSQL (recommended for production), SQLite (local dev)
- Deployment: Vercel (serverless Python + static frontend)

## Current Features

- Live ball-by-ball scoring with undo support.
- Match and tournament setup with detailed innings scorecards.
- Last Man Stands scoring flow.
- Role-based permissions with four roles:
  - `admin`
  - `manager`
  - `scorekeeper`
  - `user`
- Scorekeeper request workflow (request, approve, reject).
- Admin role extensions:
  - Admin can perform manager, scorekeeper, and user actions.
  - Admin can promote scorekeepers to managers.
  - Admin can promote users to scorekeepers or managers.

## Role and Promotion API

- `POST /api/auth/promotions/` (admin only)
  - Promote scorekeeper -> manager:
    - `{"action":"scorekeeper_to_manager","user_id":<id>}`
  - Promote user -> scorekeeper/manager:
    - `{"action":"user_promotion","user_id":<id>,"target_role":"scorekeeper"}`
    - `{"action":"user_promotion","user_id":<id>,"target_role":"manager"}`

## Local Development

### 1) Clone and install

```bash
git clone <repository-url>
cd cricket_django
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
npm --prefix frontend install
```

### 2) Migrate database

```bash
./venv/bin/python backend/manage.py migrate
```

### 3) Run the app

```bash
./start.sh
```

Or run services separately:

```bash
# backend
./venv/bin/python backend/manage.py runserver

# frontend
npm --prefix frontend run dev
```

Stop servers:

```bash
./stop.sh
```

## Create an Admin Locally

```bash
./venv/bin/python backend/manage.py createsuperuser
```

## Project Structure

```text
cricket_django/
├── api/                      # Vercel Python entrypoint
│   ├── index.py
│   └── requirements.txt
├── backend/
│   ├── cricket_backend/      # Django settings and URL config
│   ├── scoring/              # Domain app (models, views, serializers, tests)
│   └── manage.py
├── frontend/
│   └── src/
├── start.sh
├── stop.sh
└── vercel.json
```

## License

MIT
