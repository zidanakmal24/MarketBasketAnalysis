import joblib
import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rules = joblib.load(os.path.join(BASE_DIR, 'model', 'association_rules_fpgrowth.pkl'))

print(f"Total rules: {len(rules)}")
print("First rule antecedents type:", type(list(rules['antecedents'])[0]))
print("First rule antecedents item type:", type(list(list(rules['antecedents'])[0])[0]))
print("First rule antecedents item example:", repr(list(list(rules['antecedents'])[0])[0]))

# Check how many rules pass the default thresholds
min_support = 0.003
min_confidence = 0.20
filtered = rules[(rules['support'] >= min_support) & (rules['confidence'] >= min_confidence)]
print(f"Rules after filtering (support>={min_support}, conf>={min_confidence}): {len(filtered)}")

# Check min/max of support and confidence
print("Max support:", rules['support'].max())
print("Min support:", rules['support'].min())
print("Max confidence:", rules['confidence'].max())
print("Min confidence:", rules['confidence'].min())

# Check how many products are valid based on logic
top_products = joblib.load(os.path.join(BASE_DIR, 'model', 'top_products.pkl'))
products_with_rules = set()
for x in rules['antecedents']:
    for item in x:
        products_with_rules.add(item)
valid_products = sorted([str(p) for p in top_products if str(p) in products_with_rules and str(p).strip()])
print("Valid products count based on strict str() match:", len(valid_products))

valid_products_loose = sorted([str(p) for p in top_products if p in products_with_rules and str(p).strip()])
print("Valid products count based on raw p match:", len(valid_products_loose))

print("Is the product in antecedents as string?", "WHITE HANGING HEART T-LIGHT HOLDER" in products_with_rules)
