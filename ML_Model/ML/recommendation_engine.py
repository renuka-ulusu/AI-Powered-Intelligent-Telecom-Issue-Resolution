# ==========================================================
# TELECOM AI PROJECT
# RECOMMENDATION ENGINE
# ==========================================================

recommendation_db = {

    "Tower Congestion": {

        "Reason":
        "The nearby cellular tower is handling a large number of users, causing network congestion.",

        "Severity":
        "Medium",

        "Escalation":
        False,

        "Recommendations": [

            "Restart mobile data.",

            "Switch to 5G if available.",

            "Move to another nearby location.",

            "Avoid using the network during peak hours.",

            "Enable VoLTE if supported."

        ]

    },

    "Coverage Gap": {

        "Reason":
        "Your current location has weak cellular network coverage.",

        "Severity":
        "High",

        "Escalation":
        True,

        "Recommendations": [

            "Move to an open area.",

            "Avoid underground or basement locations.",

            "Restart your phone.",

            "Enable automatic network selection."

        ]

    },

    "Weather Interference": {

        "Reason":
        "Rain or storms can temporarily reduce cellular signal quality.",

        "Severity":
        "Medium",

        "Escalation":
        False,

        "Recommendations": [

            "Wait until weather conditions improve.",

            "Use Wi-Fi if available.",

            "Retry after a few minutes."

        ]

    },

    "APN Misconfiguration": {

        "Reason":
        "Incorrect APN settings may prevent proper mobile data connectivity.",

        "Severity":
        "Medium",

        "Escalation":
        False,

        "Recommendations": [

            "Reset APN settings.",

            "Restart the phone.",

            "Verify APN configuration with your SIM provider."

        ]

    },

    "DNS Issue": {

        "Reason":
        "DNS servers are not responding correctly.",

        "Severity":
        "Low",

        "Escalation":
        False,

        "Recommendations": [

            "Restart mobile data.",

            "Try again after a few minutes.",

            "Change DNS settings if supported."

        ]

    },

    "SIM Fault": {

        "Reason":
        "The SIM card may be damaged or improperly inserted.",

        "Severity":
        "High",

        "Escalation":
        True,

        "Recommendations": [

            "Remove and reinsert the SIM.",

            "Clean the SIM card carefully.",

            "Replace the SIM if necessary."

        ]

    },

    "Authentication Failure": {

        "Reason":
        "The subscriber profile could not be authenticated by the network.",

        "Severity":
        "High",

        "Escalation":
        True,

        "Recommendations": [

            "Restart your phone.",

            "Reinsert the SIM card.",

            "Contact customer care if the issue continues."

        ]

    },

    "Temporary Outage": {

        "Reason":
        "A temporary maintenance activity or outage is affecting the network.",

        "Severity":
        "Low",

        "Escalation":
        False,

        "Recommendations": [

            "Wait for a few minutes.",

            "Retry later.",

            "Check operator outage notifications."

        ]

    }

}


# ==========================================================
# GET RECOMMENDATION
# ==========================================================

def get_recommendations(cause):

    result = recommendation_db.get(cause)

    if result:

        return result

    return {

        "Reason":
        "The issue could not be analyzed completely.",

        "Severity":
        "Unknown",

        "Escalation":
        False,

        "Recommendations": [

            "Restart your phone.",

            "Restart mobile data.",

            "Try another location.",

            "Contact customer care (198) if the issue persists."

        ]

    }


# ==========================================================
# DEBUG
# ==========================================================

if __name__ == "__main__":

    print(get_recommendations("Tower Congestion"))