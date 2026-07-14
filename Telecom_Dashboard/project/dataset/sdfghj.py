import pandas as pd 
df=pd.read_excel(r"dataset/cleaned_telecom_dataset.xlsx")
print(df.columns.tolist())