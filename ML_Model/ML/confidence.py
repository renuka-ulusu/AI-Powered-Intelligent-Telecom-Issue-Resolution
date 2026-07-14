# ==========================================================
# TELECOM AI PROJECT
# ANALYSIS ENGINE
# ==========================================================

import numpy as np


def generate_analysis(model, encoder, X, top_n=4):
    """
    Generates the Top-N most probable root causes
    using prediction probabilities.

    Parameters
    ----------
    model : Trained ML Model
    encoder : LabelEncoder for Root Cause
    X : Preprocessed Feature Vector
    top_n : Number of probable causes to return

    Returns
    -------
    List[dict]
    """

    # ------------------------------------------------------
    # Get prediction probabilities
    # ------------------------------------------------------

    probabilities = model.predict_proba(X)[0]

    # ------------------------------------------------------
    # Get corresponding class labels
    # ------------------------------------------------------

    class_indices = np.arange(len(probabilities))

    class_names = encoder.inverse_transform(class_indices)

    # ------------------------------------------------------
    # Combine class names with probabilities
    # ------------------------------------------------------

    analysis = []

    for cause, probability in zip(class_names, probabilities):

        analysis.append({

            "Cause": cause,

            "Confidence": round(float(probability * 100), 2)

        })

    # ------------------------------------------------------
    # Sort by confidence
    # ------------------------------------------------------

    analysis = sorted(

        analysis,

        key=lambda item: item["Confidence"],

        reverse=True

    )

    # ------------------------------------------------------
    # Return Top-N predictions
    # ------------------------------------------------------

    return analysis[:top_n]


# ==========================================================
# OPTIONAL DEBUG
# ==========================================================

if __name__ == "__main__":

    print("Analysis Engine Loaded Successfully")