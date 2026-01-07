#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting ERP Development Environment${NC}"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL first:"
    echo "  sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL service is running
echo -e "${BLUE}Checking PostgreSQL service...${NC}"
if sudo systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${BLUE}Starting PostgreSQL...${NC}"
    sudo systemctl start postgresql
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PostgreSQL started${NC}"
    else
        echo -e "${RED}❌ Failed to start PostgreSQL${NC}"
        exit 1
    fi
fi

# Check if database exists
echo -e "${BLUE}Checking database...${NC}"
DB_NAME=${DB_NAME:-erp_db}
DB_USER=${DB_USER:-postgres}

if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${GREEN}✓ Database '$DB_NAME' exists${NC}"
else
    echo -e "${BLUE}Creating database and user...${NC}"
    sudo -u postgres psql << EOF
CREATE USER $DB_USER WITH PASSWORD 'postgres';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database created${NC}"
    else
        echo -e "${RED}❌ Failed to create database${NC}"
        exit 1
    fi
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
fi

# Start development servers
echo -e "${GREEN}✓ All systems ready!${NC}"
echo -e "${BLUE}Starting API server and frontend...${NC}"
npm run dev:all
