# ==========================================================
# TELECOM AI PROJECT
# ROOT CAUSE MODEL TRAINING
# ==========================================================

from preprocessing import preprocess
from trainer import train_models


def main():

    print("=" * 70)
    print("TRAINING ROOT CAUSE PREDICTION MODEL")
    print("=" * 70)

    # ------------------------------------------------------
    # Load & Preprocess Data
    # ------------------------------------------------------

    X, y, target_encoder, feature_names = preprocess(
        "Predicted_Root_Cause"
    )

    # ------------------------------------------------------
    # Train Models
    # ------------------------------------------------------

    train_models(
        X=X,
        y=y,
        target_encoder=target_encoder,
        model_name="rootcause"
    )

    print("\nRoot Cause Model Training Completed Successfully!")


if __name__ == "__main__":
    main()