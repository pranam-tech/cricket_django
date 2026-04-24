#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping all servers...${NC}"

# Stop Django backend
if pgrep -f "manage.py runserver" > /dev/null; then
    echo -n "Stopping Django backend... "
    pkill -f "manage.py runserver"
    echo -e "${GREEN}Done${NC}"
else
    echo -e "Django backend is ${RED}not running${NC}."
fi

# Stop Vite frontend
if pgrep -f "vite" > /dev/null; then
    echo -n "Stopping Vite frontend... "
    pkill -f "vite"
    echo -e "${GREEN}Done${NC}"
else
    echo -e "Vite frontend is ${RED}not running${NC}."
fi

echo -e "${GREEN}All cleanup operations completed.${NC}"
