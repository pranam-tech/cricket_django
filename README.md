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

## Vercel Deployment

This repo is configured for Vercel using:

- `api/index.py` for Django serverless entrypoint
- `api/requirements.txt` for Python dependencies
- `vercel.json` for API/static routing
- Root build script for frontend build output

### 1) Required environment variables (Vercel Project Settings)

- `SECRET_KEY` = strong random secret
- `DEBUG` = `False`
- `ALLOWED_HOSTS` = your Vercel domains (comma-separated), e.g. `your-app.vercel.app`
- `CORS_ALLOWED_ORIGINS` = frontend origin(s), e.g. `https://your-app.vercel.app`
- `DATABASE_URL` = Postgres connection string

### 2) Deploy

```bash
vercel
```

For production:

```bash
vercel --prod
```

### 3) Run migrations on production database

After setting `DATABASE_URL`, run migrations against your production DB from a trusted environment:

```bash
./venv/bin/python backend/manage.py migrate
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
