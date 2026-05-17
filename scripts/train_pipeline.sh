#!/bin/bash
# FinWatch Zambia - Manual Model Retraining Trigger

echo "🧠 Starting ML Training Pipeline..."

cd backend

# Ensure we are using the correct python environment
if [ -d "venv" ]; then
    # Detect OS for activation
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        source venv/Scripts/activate
    else
        source venv/bin/activate
    fi
fi

# Run training
echo "🔄 Training Authoritative (Random Forest) and Baseline (Logistic Regression) models..."
python -m ml.train

echo "📊 Evaluating Model Performance & SHAP explanations..."
python -m ml.evaluate

echo "✨ Artifacts updated in backend/ml/artifacts/"
