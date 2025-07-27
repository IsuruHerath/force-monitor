#!/bin/bash

echo "🚀 Setting up Force Monitor development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "❌ Redis is not installed. Please install Redis first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Setup backend
echo "📦 Setting up backend..."
cd backend
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your Salesforce credentials"
fi
npm install
cd ..

# Setup frontend
echo "🎨 Setting up frontend..."
cd frontend
if [ ! -f ".env" ]; then
    cp .env.example .env
fi
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your Salesforce Connected App credentials"
echo "2. Start Redis: redis-server"
echo "3. Start backend: cd backend && npm run dev"
echo "4. Start frontend: cd frontend && npm start"
echo ""
echo "Visit http://localhost:3000 to see the application!"