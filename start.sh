#!/bin/bash

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting CricTracker Servers...${NC}"

# Start Backend
echo -e "${GREEN}Starting Django Backend...${NC}"
# Check if venv exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi
cd backend
python manage.py runserver &
BACKEND_PID=$!
cd ..

# Start Frontend
echo -e "${GREEN}Starting Vite Frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${YELLOW}Servers starting...${NC}"
echo -e "Use ${GREEN}./stop.sh${NC} to stop them."

# Wait for background processes
wait
