from preprocessing import preprocess
from trainer import train_models


def main():

    print("=" * 70)
    print("TRAINING SEVERITY PREDICTION MODEL")
    print("=" * 70)

    # ------------------------------------------------------
    # Load & Preprocess Data
    # ------------------------------------------------------

    X, y, target_encoder, feature_names = preprocess(
        "Severity_Level"
    )

    # ------------------------------------------------------
    # Train Models
    # ------------------------------------------------------

    train_models(
        X=X,
        y=y,
        target_encoder=target_encoder,
        model_name="severity"
    )

    print("\nSeverity Model Training Completed Successfully!")


if __name__ == "__main__":
    main()