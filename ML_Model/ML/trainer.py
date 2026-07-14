
# ==========================================================
# TELECOM AI PROJECT
# trainer.py
# ==========================================================

import os
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier


def train_models(X, y, target_encoder, model_name):

    os.makedirs("saved_models", exist_ok=True)
    os.makedirs("reports", exist_ok=True)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    models = {
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            random_state=42,
            n_jobs=-1
        ),
        "XGBoost": XGBClassifier(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=6,
            random_state=42,
            eval_metric="mlogloss"
        ),
        "LightGBM": LGBMClassifier(
            n_estimators=200,
            random_state=42
        ),
        "CatBoost": CatBoostClassifier(
            iterations=200,
            learning_rate=0.1,
            random_state=42,
            verbose=0
        )
    }

    results = []
    best_model = None
    best_accuracy = 0

    for name, model in models.items():

        print(f"Training {name}...")

        model.fit(X_train, y_train)

        predictions = model.predict(X_test)

        accuracy = accuracy_score(y_test, predictions)
        precision = precision_score(y_test, predictions, average="weighted", zero_division=0)
        recall = recall_score(y_test, predictions, average="weighted", zero_division=0)
        f1 = f1_score(y_test, predictions, average="weighted", zero_division=0)

        results.append({
            "Model": name,
            "Accuracy": accuracy,
            "Precision": precision,
            "Recall": recall,
            "F1 Score": f1
        })

        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_model = model

    results_df = pd.DataFrame(results).sort_values("Accuracy", ascending=False)

    print(results_df)

    results_df.to_csv(
        f"reports/{model_name}_metrics.csv",
        index=False
    )

    joblib.dump(
        best_model,
        f"saved_models/{model_name}_model.pkl"
    )

    joblib.dump(
        target_encoder,
        f"saved_models/{model_name}_encoder.pkl"
    )

    final_predictions = best_model.predict(X_test)

    report = classification_report(
        y_test,
        final_predictions,
        target_names=target_encoder.classes_,
        zero_division=0
    )

    with open(
        f"reports/{model_name}_classification_report.txt",
        "w",
        encoding="utf-8"
    ) as file:
        file.write(report)

    print("\\nBest Model Saved Successfully")
    print(f"Accuracy : {best_accuracy:.4f}")

    return best_model
