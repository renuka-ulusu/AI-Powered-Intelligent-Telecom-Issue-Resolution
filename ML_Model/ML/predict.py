import joblib
import pandas as pd
from scipy.sparse import hstack
from matcher import IssueMatcher
from emergency import emergency_response
from confidence import generate_analysis
from recommendation_engine import get_recommendations

# ==========================================================
# LOAD TRAINED MODELS
# ==========================================================

print("Loading AI Models...")

root_model = joblib.load("saved_models/rootcause_model.pkl")
severity_model = joblib.load("saved_models/severity_model.pkl")
escalation_model = joblib.load("saved_models/escalation_model.pkl")

tfidf = joblib.load("saved_models/tfidf.pkl")
label_encoders = joblib.load("saved_models/label_encoders.pkl")

root_encoder = joblib.load(
    "saved_models/Predicted_Root_Cause_encoder.pkl"
)

severity_encoder = joblib.load(
    "saved_models/Severity_Level_encoder.pkl"
)

escalation_encoder = joblib.load(
    "saved_models/Escalation_Required_encoder.pkl"
)

print("Models Loaded Successfully")

matcher = IssueMatcher() 
# ==========================================================
# SOLUTION LOOKUP
# ==========================================================

solution_lookup = {

    "Tower Outage":
    "A field engineer has been dispatched to inspect the nearby tower.",

    "Coverage Gap":
    "Escalate to RF Optimization Team.",

    "Network Congestion":
    "Optimize network traffic and monitor tower load.",

    "SIM Fault":
    "Replace the customer's SIM card.",

    "Device Configuration":
    "Guide customer to verify device network settings.",

    "Tower Congestion":
    "Increase tower capacity and optimize load.",

    "VoLTE Failure":
    "Refresh VoLTE provisioning.",

    "Radio Failure":
    "Escalate to Radio Network Team.",

    "Backhaul Issue":
    "Inspect backhaul connectivity.",

    "DNS Issue":
    "Update DNS configuration.",

    "APN Misconfiguration":
    "Reset APN settings.",

    "Core Network Issue":
    "Escalate to Core Network Team.",

    "SIM Activation Pending":
    "Complete SIM activation.",

    "Authentication Failure":
    "Re-authenticate subscriber profile.",

    "Weather Interference":
    "Wait until weather conditions improve.",

    "Frequency Interference":
    "Investigate RF interference.",

    "Network Upgrade":
    "Inform customer about planned rollout.",

    "Temporary Outage":
    "Retry after maintenance.",

    "IMS Configuration":
    "Refresh IMS Profile.",

    "SMS Gateway Delay":
    "Retry once gateway service is restored."

}


# ==========================================================
# PREDICTION FUNCTION
# ==========================================================

def predict_issue(data):


    matched_issue, score = matcher.match_issue(
        data["Customer_Issue"]
    )

    print("Matched Issue :", matched_issue)
    print("Similarity :", score)

    if score < 25:

         return emergency_response()

    data["Customer_Issue"] = matched_issue
    df = pd.DataFrame([data])

    # ----------------------------------------------
    # Create Text Feature
    # ----------------------------------------------

    df["Issue_Text"] = (

        df["Customer_Issue"]

        + " "

        + df["SIM_Provider"]

        + " "

        + df["Network_Type"]

        + " "

        + df["City_Type"]

        + " "

        + df["Signal_Strength"]

        + " "

        + df["Tower_Load"]

        + " "

        + df["Weather"]

    )

    # ----------------------------------------------
    # TF-IDF
    # ----------------------------------------------

    text_features = tfidf.transform(df["Issue_Text"])

    df.drop(columns=["Issue_Text"], inplace=True)

    # ----------------------------------------------
    # Label Encoding
    # ----------------------------------------------

    for col in label_encoders:

        if col in df.columns:

            mapping = {

                cls: idx

                for idx, cls in enumerate(

                    label_encoders[col].classes_

                )

            }

            df[col] = df[col].map(mapping).fillna(-1)
            # ----------------------------------------------
    # Combine Features
    # ----------------------------------------------

    X = hstack([text_features, df.values])
    print("=" * 60)
    print("Prediction Feature Shape:", X.shape)

    print("Structured Columns:")
    print(df.columns.tolist())

    print("Number of Structured Columns:", len(df.columns))

    print("TF-IDF Vocabulary Size:", len(tfidf.vocabulary_))

    print("Model expects:", root_model.n_features_in_)
    print("=" * 60)

    root = root_encoder.inverse_transform(
        root_model.predict(X).ravel()
    )[0]
     

    # ==========================================================
    # AI ANALYSIS
    # ==========================================================

    analysis = generate_analysis(

        root_model,

        root_encoder,

        X,

        top_n=4

    )

    print("\nTop Possible Causes")

    for item in analysis:

        print(item)
    # ----------------------------------------------
    # Predictions
    # ----------------------------------------------

    root = root_encoder.inverse_transform(

    root_model.predict(X).ravel()

    )[0]

    # DEBUG
    print("Predicted Root Cause:", repr(root))

    severity = severity_encoder.inverse_transform(

    severity_model.predict(X).ravel()

    )[0]

    escalation = escalation_encoder.inverse_transform(

        escalation_model.predict(X).ravel()

    )[0]

    recommendation=get_recommendations(
        root.strip().title()
    )

    return {
        "Issue": matched_issue,

        "Root Cause": root,

        "Possible Causes": analysis,

        "Severity": severity,

        "Escalation": escalation,

        "Reason": recommendation["Reason"],

        "Recommendion": recommendation["Recommendations"],

        "Emergency Contact": "198"

    }


# ==========================================================
# TEST
# ==========================================================

if __name__ == "__main__":

    sample = {

        "SIM_Provider": "Jio",

        "City_Type": "Urban",

        "Network_Type": "5G",

        "Customer_Issue": "No Signal",

        "Signal_Strength": "Poor",

        "Tower_Load": "High",

        "Weather": "Rain",

        "Previous_Complaints": 2

    }
    
    result = predict_issue(sample)

    print("\nPrediction Result\n")

    for key, value in result.items():

        print(f"{key}: {value}")