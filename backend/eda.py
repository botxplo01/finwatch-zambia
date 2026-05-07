import numpy as np
import pandas as pd
from scipy.io import arff

import os

"""Exploratory data analysis (EDA) for the ARFF-based SME distress dataset.

This script:
    - Loads the dataset from the repository's data directory.
    - Normalises the target label representation.
    - Reports class distribution, missingness, and descriptive statistics for
      the selected feature subset used as core financial ratios.

The output is printed to stdout for capture into documentation.
"""

# Resolve dataset path relative to this module.
base_path = os.path.dirname(os.path.abspath(__file__))
arff_path = os.path.join(base_path, "..", "data", "3year.arff")
if not os.path.exists(arff_path):
    arff_path = os.path.join(base_path, "data", "3year.arff")

# Load dataset into a DataFrame.
data, meta = arff.loadarff(arff_path)
df = pd.DataFrame(data)

# Decode byte strings (arff files encode strings as bytes)
df["class"] = df["class"].apply(
    lambda x: x.decode("utf-8") if isinstance(x, bytes) else x
)

print("=" * 60)
print("DATASET SHAPE")
print(f"Total records: {len(df)}")
print(f"Total features: {len(df.columns) - 1}")  # excluding class column

# Class distribution
print("\n" + "=" * 60)
print("CLASS DISTRIBUTION (raw counts)")
class_counts = df["class"].value_counts()
print(class_counts)
print(
    f"\nClass 0 (Non-distressed): {class_counts.get('0', class_counts.get(0, 'N/A'))}"
)
print(f"Class 1 (Distressed):     {class_counts.get('1', class_counts.get(1, 'N/A'))}")
total = len(df)
for cls, count in class_counts.items():
    print(f"Class {cls}: {count} ({count / total * 100:.1f}%)")

# Selected features (mapped to the 10 core financial ratios).
selected_features = {
    "Attr1": "Return on Assets",
    "Attr2": "Debt-to-Assets",
    "Attr4": "Current Ratio",
    "Attr8": "Debt-to-Equity (raw)",
    "Attr9": "Asset Turnover",
    "Attr10": "Equity Ratio (ROE base)",
    "Attr23": "Net Profit Margin",
    "Attr27": "Interest Coverage",
    "Attr40": "Cash Ratio",
    "Attr46": "Quick Ratio",
}

# Missing values
print("\n" + "=" * 60)
print("MISSING VALUES - Selected Features")
print(f"{'Feature':<10} {'Ratio Name':<30} {'Missing':>8} {'% Missing':>10}")
print("-" * 62)
for attr, name in selected_features.items():
    missing = df[attr].isna().sum()
    pct = missing / total * 100
    print(f"{attr:<10} {name:<30} {missing:>8} {pct:>9.1f}%")

# Descriptive statistics by class
print("\n" + "=" * 60)
print("DESCRIPTIVE STATISTICS BY CLASS - Selected Features")

for attr, name in selected_features.items():
    print(f"\n--- {name} ({attr}) ---")
    stats = df.groupby("class")[attr].agg(["mean", "median", "std", "min", "max"])
    print(stats.round(4))

# Overall descriptive statistics
print("\n" + "=" * 60)
print("OVERALL DESCRIPTIVE STATISTICS - Selected Features")
print(df[list(selected_features.keys())].describe().round(4))

print("\n" + "=" * 60)
print("EDA COMPLETE - Copy all output above for Chapter 4")
