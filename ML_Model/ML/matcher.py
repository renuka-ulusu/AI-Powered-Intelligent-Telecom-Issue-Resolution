# ==========================================================
# TELECOM AI PROJECT
# ISSUE MATCHER
# ==========================================================

import pandas as pd
from rapidfuzz import process, fuzz


class IssueMatcher:

    def __init__(self):

        self.df = pd.read_excel(
            "dataset/cleaned_telecom_dataset.xlsx"
        )

        self.known_issues = sorted(
            self.df["Customer_Issue"]
            .dropna()
            .astype(str)
            .str.lower()
            .unique()
        )

    def match_issue(self, user_issue):

        user_issue = user_issue.lower()

        match = process.extractOne(

            user_issue,

            self.known_issues,

            scorer=fuzz.token_sort_ratio

        )

        if match is None:

            return None, 0

        issue = match[0]
        score = match[1]

        return issue, score