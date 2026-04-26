"""
FinWatch Zambia - ML Training Pipeline Entry Point

Orchestrates the full offline training pipeline:
1. Preprocessing (preprocess.py)
2. Model training (train_models.py)
3. Evaluation (evaluate.py)
4. SHAP (explain.py)

Usage (run from backend/):
  python ml/train.py
  python ml/train.py --data-path ../../data/3year.arff
  python ml/train.py --data-path ../../data/3year.arff --year 3 --verbose

Dataset: UCI Polish Companies Bankruptcy (DOI: 10.24432/C5V61K)
Recommended: 3year.arff (10,503 records, best horizon balance)
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import numpy as np


def setup_logging(verbose: bool = False) -> None:
    """Configure logging for the training pipeline."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
        datefmt="%H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )
    logging.getLogger("shap").setLevel(logging.WARNING)
    logging.getLogger("sklearn").setLevel(logging.WARNING)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="FinWatch Zambia — ML Training Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ml/train.py
  python ml/train.py --data-path ../../data/3year.arff
  python ml/train.py --data-path ../../data/3year.arff --year 3 --verbose
  python ml/train.py --skip-explain

Dataset: UCI Polish Companies Bankruptcy (DOI: 10.24432/C5V61K)
Recommended: 3year.arff (10,503 records, best horizon balance)
        """,
    )
    parser.add_argument(
        "--data-path",
        type=Path,
        default=_BACKEND_DIR.parent / "data" / "3year.arff",
        help="Path to UCI Polish Companies Bankruptcy .arff or .csv file.",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=3,
        choices=[1, 2, 3, 4, 5],
        help="UCI dataset year (for logging/metadata only, default: 3)",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=_BACKEND_DIR / "ml" / "artifacts",
        help="Directory to write model artifacts (default: backend/ml/artifacts/)",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Proportion of data for test set (default: 0.2)",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    parser.add_argument(
        "--skip-train",
        action="store_true",
        help="Skip training (load existing artifacts)",
    )
    parser.add_argument(
        "--skip-explain",
        action="store_true",
        help="Skip SHAP explanation step (faster iteration during development)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable DEBUG-level logging",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point — orchestrates the full training pipeline."""
    args = parse_args()
    setup_logging(args.verbose)
    logger = logging.getLogger("train")

    t_total = time.time()

    logger.info("=" * 70)
    logger.info("FinWatch Zambia — ML Training Pipeline")
    logger.info("=" * 70)
    logger.info("Data path:     %s", args.data_path)
    logger.info("Artifacts dir: %s", args.artifacts_dir)
    logger.info("Dataset year:  %d", args.year)
    logger.info("Test size:     %.0f%%", args.test_size * 100)
    logger.info("Random state:  %d", args.random_state)

    if not args.data_path.exists():
        logger.error(
            "Dataset file not found: %s\n"
            "Download the UCI Polish Companies Bankruptcy dataset:\n"
            "  URL: https://archive.ics.uci.edu/dataset/365\n"
            "  DOI: 10.24432/C5V61K\n"
            "Place the file at: %s",
            args.data_path,
            args.data_path,
        )
        sys.exit(1)

    import joblib

    from ml.evaluate import evaluate_all_models
    from ml.explain import explain_all_models
    from ml.preprocess import load_and_preprocess
    from ml.train_models import train_all_models

    logger.info("\n%s\nStage 1: Preprocessing\n%s", "=" * 70, "=" * 70)
    t1 = time.time()

    data = load_and_preprocess(
        data_path=args.data_path,
        artifacts_path=args.artifacts_dir,
        test_size=args.test_size,
        random_state=args.random_state,
    )

    X_train = data["X_train"]
    X_test = data["X_test"]
    y_train = data["y_train"]
    y_test = data["y_test"]

    logger.info("Preprocessing complete in %.1fs", time.time() - t1)

    if not args.skip_train:
        logger.info("\n%s\nStage 2: Model Training\n%s", "=" * 70, "=" * 70)
        t2 = time.time()

        models = train_all_models(
            X_train=X_train,
            y_train=y_train,
            artifacts_path=args.artifacts_dir,
        )

        logger.info("Training complete in %.1fs", time.time() - t2)
    else:
        logger.info("Skipping training — loading existing artifacts...")
        models = {}
        for model_name in ["logistic_regression", "random_forest"]:
            artifact = args.artifacts_dir / f"{model_name}.joblib"
            if artifact.exists():
                models[model_name] = joblib.load(artifact)
                logger.info("Loaded: %s", artifact)
            else:
                logger.warning("Artifact not found: %s", artifact)

    if not models:
        logger.error("No models available. Run without --skip-train first.")
        sys.exit(1)

    logger.info("\n%s\nStage 3: Evaluation\n%s", "=" * 70, "=" * 70)
    t3 = time.time()

    results = evaluate_all_models(
        models=models,
        X_test=X_test,
        y_test=y_test,
        artifacts_path=args.artifacts_dir,
    )

    logger.info("Evaluation complete in %.1fs", time.time() - t3)

    if not args.skip_explain:
        logger.info("\n%s\nStage 4: SHAP Explanations\n%s", "=" * 70, "=" * 70)
        t4 = time.time()

        explain_all_models(
            models=models,
            X_train=X_train,
            X_test=X_test,
            artifacts_path=args.artifacts_dir,
        )

        logger.info("SHAP complete in %.1fs", time.time() - t4)
    else:
        logger.info("Skipping SHAP explanation step (--skip-explain flag set).")

    total_time = time.time() - t_total
    logger.info("\n%s", "=" * 70)
    logger.info("TRAINING PIPELINE COMPLETE")
    logger.info("Total time: %.1fs (%.1f minutes)", total_time, total_time / 60)
    logger.info("Artifacts saved to: %s", args.artifacts_dir)
    logger.info("%s", "=" * 70)

    logger.info("\nFINAL METRICS SUMMARY:")
    logger.info(
        "%-30s  %-8s  %-8s  %-8s  %-8s  %-8s",
        "Model",
        "Acc",
        "F1",
        "Recall",
        "ROC-AUC",
        "PR-AUC",
    )
    logger.info("-" * 75)
    for name, r in results.items():
        logger.info(
            "%-30s  %-8.4f  %-8.4f  %-8.4f  %-8.4f  %-8.4f",
            name,
            r["accuracy"],
            r["f1"],
            r["recall"],
            r["roc_auc"],
            r["pr_auc"],
        )

    logger.info(
        "\nNext step: restart the FastAPI server to load the new artifacts.\n"
        "  uvicorn main:app --reload --port 8000"
    )


if __name__ == "__main__":
    main()
