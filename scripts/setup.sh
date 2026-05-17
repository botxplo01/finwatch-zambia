#!/bin/bash
# FinWatch Zambia - Automated Environment Setup

echo "🚀 Starting FinWatch Zambia setup..."

# 1. Setup Backend
echo "📦 Setting up Python Virtual Environment..."
cd backend
if [ ! -d "venv" ]; then
    python -m venv venv
fi

# Detect OS for activation
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

echo "📥 Installing dependencies..."
pip install -r requirements.txt

echo "🗄️ Initialising Database..."
alembic upgrade head

# 2. Setup Frontend
echo "⚛️ Installing Frontend Dependencies..."
cd ../frontend
npm install

echo "✅ Setup Complete. Run 'npm run dev' and 'uvicorn app.main:app' to start."
