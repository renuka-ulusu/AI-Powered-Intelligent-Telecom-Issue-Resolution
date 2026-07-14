# ==========================================================
# TELECOM AI PROJECT
# COMMON PREPROCESSING PIPELINE
# ==========================================================

import os
import joblib
import pandas as pd

from scipy.sparse import hstack
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer


def preprocess(target_column):

    print("=" * 70)
    print(f"Preparing Dataset for {target_column}")
    print("=" * 70)

    # ------------------------------------------------------
    # Load Dataset
    # ------------------------------------------------------

    df = pd.read_excel(r"dataset/cleaned_telecom_dataset.xlsx")

    print("\nDataset Loaded Successfully")
    print("Shape :", df.shape)

    # ------------------------------------------------------
    # Drop Unnecessary Columns
    # ------------------------------------------------------

    drop_columns = [
        "Ticket_ID",
        "Complaint_Date"
    ]

    df.drop(columns=drop_columns, errors="ignore", inplace=True)

    # ------------------------------------------------------
    # Create Combined Text Feature
    # ------------------------------------------------------

    df["Issue_Text"] = (

        df["Customer_Issue"].astype(str)

        + " "

        + df["SIM_Provider"].astype(str)

        + " "

        + df["Network_Type"].astype(str)

        + " "

        + df["City_Type"].astype(str)

        + " "

        + df["Signal_Strength"].astype(str)

        + " "

        + df["Tower_Load"].astype(str)

        + " "

        + df["Weather"].astype(str)

    )

    # ------------------------------------------------------
    # Target Variable
    # ------------------------------------------------------

    y = df[target_column]

    # ------------------------------------------------------
    # Remove Leakage Columns
    # ------------------------------------------------------

    leakage_columns = [
        "Predicted_Root_Cause",
        "Suggested_Solution",
        "Severity_Level",
        "Escalation_Required"
    ]

    # Always remove the target column from X
    columns_to_drop = list(set(leakage_columns + [target_column]))

    X = df.drop(columns=columns_to_drop, errors="ignore")

    # ------------------------------------------------------
    # TF-IDF
    # ------------------------------------------------------

    print("\nApplying TF-IDF...")

    tfidf = TfidfVectorizer(
        stop_words="english",
        max_features=300
    )

    text_features = tfidf.fit_transform(X["Issue_Text"])

    X.drop(columns=["Issue_Text"], inplace=True)

    # ------------------------------------------------------
    # Encode Categorical Columns
    # ------------------------------------------------------

    print("\nEncoding Columns")

    label_encoders = {}

    categorical_columns = X.select_dtypes(include="object").columns

    for col in categorical_columns:

        encoder = LabelEncoder()

        X[col] = encoder.fit_transform(X[col])

        label_encoders[col] = encoder

    # ------------------------------------------------------
    # Encode Target
    # ------------------------------------------------------

    target_encoder = LabelEncoder()

    y = target_encoder.fit_transform(y)

    # ------------------------------------------------------
    # Combine Features
    # ------------------------------------------------------

    X_final = hstack([text_features, X.values])

    # ------------------------------------------------------
    # Save Objects
    # ------------------------------------------------------

    os.makedirs("saved_models", exist_ok=True)

    joblib.dump(
        tfidf,
        "saved_models/tfidf.pkl"
    )

    joblib.dump(
        label_encoders,
        "saved_models/label_encoders.pkl"
    )

    joblib.dump(
        target_encoder,
        f"saved_models/{target_column}_encoder.pkl"
    )

    # ------------------------------------------------------
    # Debug Information
    # ------------------------------------------------------

    feature_names = list(X.columns)

    print("\nStructured Features")

    for col in feature_names:
        print(col)

    print("\nFeature Matrix :", X_final.shape)
    print("Target Shape   :", y.shape)

    print("\n========== TRAINING DEBUG ==========")
    print("TF-IDF Features      :", text_features.shape[1])
    print("Structured Features :", len(feature_names))
    print("Final Feature Shape :", X_final.shape)
    print("====================================")

    print("\nPreprocessing Completed Successfully")

    return X_final, y, target_encoder, feature_names


# ==========================================================
# Standalone Test
# ==========================================================

if __name__ == "__main__":

    preprocess("Predicted_Root_Cause")