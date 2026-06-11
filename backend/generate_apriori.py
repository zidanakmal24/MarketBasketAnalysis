import pandas as pd
import joblib
from mlxtend.preprocessing import TransactionEncoder
from mlxtend.frequent_patterns import apriori, association_rules
import os

def main():
    print("Memuat dataset sampel (50,000 baris)...")
    try:
        order_products = pd.read_csv('../data/order_products__prior.csv', nrows=50000)
        products = pd.read_csv('../data/products.csv')
    except Exception as e:
        print("Gagal memuat dataset:", e)
        return

    print("Menggabungkan data...")
    df = order_products.merge(products, on='product_id')

    print("Membentuk list keranjang belanja...")
    basket = df.groupby('order_id')['product_name'].apply(list).tolist()

    print("One-hot encoding...")
    te = TransactionEncoder()
    te_ary = te.fit(basket).transform(basket)
    df_trans = pd.DataFrame(te_ary, columns=te.columns_)

    print("Menjalankan Algoritma Apriori...")
    # Support diturunkan sedikit karena sampel kecil
    frequent_itemsets = apriori(df_trans, min_support=0.005, use_colnames=True)

    print("Menghasilkan aturan asosiasi (rules)...")
    if not frequent_itemsets.empty:
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=0.1)
        
        print("Menyimpan model ke ../model/apriori_rules.pkl...")
        os.makedirs('../model', exist_ok=True)
        joblib.dump(rules, '../model/apriori_rules.pkl')
        print(f"Selesai! Berhasil membuat {len(rules)} rules.")
    else:
        print("Itemsets kosong, tidak ada rule yang terbentuk.")

if __name__ == '__main__':
    main()
