# CricTracker: Professional Cricket Scoring Platform

A robust, full-stack cricket scoring application built with Django and React. Designed for real-time match tracking, detailed scorecards, and tournament management.

## 🚀 Tech Stack

- **Backend**: Django 6.0+, Django REST Framework
- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion
- **Database**: PostgreSQL (Development supports SQLite)
- **Icons**: Lucide React

## ✨ Features

- **Live Scoring**: Real-time ball-by-ball updates with strike rotation logic.
- **Match Management**: Setup quick matches with custom team names and player counts.
- **Detailed Scorecards**: Comprehensive batting and bowling statistics for both innings.
- **Undo Functionality**: Correct mistakes easily with atomic undo operations that revert all stats.
- **Last Man Stands Mode**: Support for specialized cricket formats where the last batsman stays on strike.
- **Responsive UI**: A modern, premium interface optimized for both mobile and desktop use.

## 🛠️ Getting Started

### 1. Clone the repository
```bash
git clone <repository-url>
cd cricket_django
```

### 2. Backend Setup
```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations
cd backend
python manage.py migrate
cd ..
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cd ..
```

## 🏃 Running the Project

### Start Backend
```bash
cd backend
python manage.py runserver
```

### Start Frontend
```bash
cd frontend
npm run dev
```

### Stopping Servers
Use the provided utility script to kill both servers at once:
```bash
./stop.sh
```

## 📁 Project Structure

```
cricket_django/
├── backend/            # Django project & apps
│   ├── cricket_backend/# Core settings and config
│   ├── scoring/        # Main logic for cricket scoring (Models, Views, Serializers)
│   └── manage.py
├── frontend/           # React + Vite application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # View components (MatchSetup, Scoring, Summary, etc.)
│   │   └── api.js      # Frontend API client
├── stop.sh             # Utility script to stop all servers
└── start.sh            # Utility script to start backend and frontend
```

## 📜 License

MIT
