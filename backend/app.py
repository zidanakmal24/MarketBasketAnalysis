from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Market Basket Analysis API")

# Setup CORS agar Frontend bisa menghubungi API Backend ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Izinkan semua asal (untuk development)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Menentukan absolute path dasar dari direktori saat ini
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Variabel global untuk menyimpan model
rules_fpgrowth = None
rules_apriori = None
top_products = []
valid_products = []

def load_model():
    global rules_fpgrowth, rules_apriori, top_products, valid_products
    try:
        rules_fpgrowth = joblib.load(os.path.join(BASE_DIR, 'model', 'association_rules_fpgrowth.pkl'))
        
        # Coba muat apriori, jika tidak ada pakai fpgrowth sementara
        try:
            rules_apriori = joblib.load(os.path.join(BASE_DIR, 'model', 'association_rules_apriori.pkl'))
        except:
            rules_apriori = rules_fpgrowth
            print("Warning: association_rules_apriori.pkl belum siap, fallback ke fpgrowth")
            
        top_products = joblib.load('../model/top_products.pkl')
        
        products_with_rules = set()
        for x in rules_fpgrowth['antecedents']:
            for item in x:
                products_with_rules.add(item)
                
        valid_products = sorted([str(p) for p in top_products if str(p) in products_with_rules and str(p).strip()])
        print(f"Model berhasil dimuat! {len(valid_products)} produk siap digunakan.")
    except Exception as e:
        print(f"Error memuat model: {e}")

# Memuat model saat server dijalankan (startup event)
@app.on_event("startup")
async def startup_event():
    load_model()

# Route untuk mengecek apakah server hidup
@app.get("/")
def read_root():
    return {"status": "ok", "message": "API Market Basket Analysis Berjalan!"}

# Route untuk mendapatkan daftar semua produk populer (untuk dropdown Frontend)
@app.get("/api/products")
def get_products():
    if not valid_products:
        raise HTTPException(status_code=500, detail="Data produk belum dimuat.")
    return {"products": valid_products}

# Route untuk mendapatkan metrik KPI (Total Produk & Total Rules)
@app.get("/api/stats")
def get_stats():
    if rules_fpgrowth is None:
        raise HTTPException(status_code=500, detail="Model belum dimuat.")
    return {
        "total_rules": len(rules_fpgrowth),
        "total_products": len(valid_products)
    }

# Route untuk mendapatkan top 10 produk terlaris
@app.get("/api/top-bestsellers")
def get_top_bestsellers():
    if len(top_products) == 0:
        raise HTTPException(status_code=500, detail="Data produk belum dimuat.")
    # Mengambil 10 produk terlaris
    return {"bestsellers": [str(p) for p in top_products[:10] if str(p).strip()]}

# Route untuk mendapatkan top 5 bundling (berdasarkan Lift tertinggi di semua rule)
@app.get("/api/top-bundles")
def get_top_bundles():
    if rules_fpgrowth is None or rules_fpgrowth.empty:
        raise HTTPException(status_code=500, detail="Model belum dimuat.")
    
    # Ambil 5 rule dengan nilai lift tertinggi
    top_rules = rules_fpgrowth.sort_values('lift', ascending=False).head(5)
    bundles = []
    
    for idx, row in top_rules.iterrows():
        bundles.append({
            "antecedents": list(row['antecedents']),
            "consequents": list(row['consequents']),
            "confidence": round(row['confidence'], 3),
            "lift": round(row['lift'], 3),
            "support": round(row['support'], 4)
        })
        
    return {"bundles": bundles}

# MOUNT FRONTEND
frontend_path = os.path.join(BASE_DIR, 'frontend')
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def serve_frontend():
    return FileResponse(os.path.join(frontend_path, 'index.html'))

# Struktur data input yang diharapkan dari Frontend
class RecommendationRequest(BaseModel):
    product_name: str
    algorithm: str = "fpgrowth"
    min_support: float = 0.003
    min_confidence: float = 0.20
    top_n: int = 5

# Route utama untuk sistem rekomendasi
@app.post("/api/recommend")
def recommend(request: RecommendationRequest):
    if rules_fpgrowth is None:
        raise HTTPException(status_code=500, detail="Model belum dimuat. Pastikan file .pkl ada di folder model/")

    # Pilih model algoritma
    if request.algorithm == "apriori":
        current_rules = rules_apriori
    else:
        current_rules = rules_fpgrowth

    product_name = request.product_name

    # Terapkan filter dinamis dari slider
    filtered_rules = current_rules[
        (current_rules['support'] >= request.min_support) & 
        (current_rules['confidence'] >= request.min_confidence)
    ]

    # Cari target di bagian antecedents (produk pembentuk aturan)
    mask = filtered_rules['antecedents'].apply(lambda x: product_name in x)
    matched_rules = filtered_rules[mask]

    if matched_rules.empty:
        return {"product": product_name, "recommendations": [], "message": "Tidak ada rekomendasi yang kuat untuk produk ini."}
    
    # 2. Urutkan berdasarkan nilai lift tertinggi untuk mencari asosiasi paling kuat
    matched_rules = matched_rules.sort_values('lift', ascending=False)
    
    # 3. Ambil top_n konsekuen (consequents)
    recommendations = []
    seen = set()
    
    for idx, row in matched_rules.iterrows():
        # Consequents bisa berupa himpunan beberapa produk, kita pecah menjadi individual produk
        for cons_item in list(row['consequents']):
            if cons_item not in seen and cons_item != product_name:
                seen.add(cons_item)
                recommendations.append({
                    "product": cons_item,
                    "confidence": round(row['confidence'], 3),
                    "lift": round(row['lift'], 3),
                    "support": round(row['support'], 4)
                })
            
            if len(recommendations) >= request.top_n:
                break
        if len(recommendations) >= request.top_n:
            break
            
    return {
        "product": product_name,
        "recommendations": recommendations,
        "message": f"Ditemukan {len(recommendations)} rekomendasi."
    }

if __name__ == "__main__":
    import uvicorn
    # Menjalankan server di port 8080 untuk menghindari konflik
    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=True)
