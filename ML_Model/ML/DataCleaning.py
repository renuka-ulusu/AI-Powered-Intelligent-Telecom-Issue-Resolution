import pandas as pd
import numpy as np

df.shape

df.dtypes

df.isnull().sum()

df.head(10)

df.duplicated().sum()

for col in df.select_dtypes(include='object'):
    df[col] = df[col].str.strip()

text_columns = [
    "Customer_Issue",
    "Predicted_Root_Cause",
    "Suggested_Solution"
]

for col in text_columns:
    df[col] = df[col].str.lower()

df.head()

df["Complaint_Date"] = pd.to_datetime(df["Complaint_Date"])

df.dtypes

for col in df.columns:
    print(col)
    print(df[col].nunique())
    print("-"*40)

df.describe()


print(df.shape)

print(df.isnull().sum())

print(df.duplicated().sum())

df.info()