#!/bin/bash
# =============================================================================
# scripts/train_pipeline.sh — Manual Model Retraining Trigger
# =============================================================================

echo "🧠 Starting ML Training Pipeline..."

cd backend

# Ensure we are using the correct python environment
if [ -d "venv" ]; then
    source venv/Scripts/activate
fi

# Run training
python -m ml.train

echo "📊 Evaluating Model Performance..."
python -m ml.evaluate

echo "✨ Artifacts updated in backend/ml/artifacts/"
