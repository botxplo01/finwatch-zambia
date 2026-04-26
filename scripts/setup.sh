#!/bin/bash
# FinWatch Zambia - Automated Environment Setup

echo "🚀 Starting FinWatch Zambia setup..."

# 1. Setup Backend
echo "📦 Setting up Python Virtual Environment..."
cd backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt

echo "🗄️ Initialising Database..."
alembic upgrade head

# 2. Setup Frontend
echo "⚛️ Installing Frontend Dependencies..."
cd ../frontend
npm install

echo "✅ Setup Complete. Run 'npm run dev' and 'uvicorn app.main:app' to start."
