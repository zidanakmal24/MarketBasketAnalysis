document.addEventListener('DOMContentLoaded', function() {
    var kpiProducts = document.getElementById('kpi-products');
    var kpiRules = document.getElementById('kpi-rules');

    // Setup Slider Listeners
    var minSupportSlider = document.getElementById('min-support');
    var minConfidenceSlider = document.getElementById('min-confidence');
    var supportVal = document.getElementById('support-val');
    var confidenceVal = document.getElementById('confidence-val');

    minSupportSlider.addEventListener('input', function() {
        supportVal.innerText = parseFloat(this.value).toFixed(3);
    });

    minConfidenceSlider.addEventListener('input', function() {
        confidenceVal.innerText = parseFloat(this.value).toFixed(2);
    });

    var productSelect = document.getElementById('product-select');
    var btnAnalyze = document.getElementById('btn-analyze');
    var welcomeMessage = document.getElementById('welcome-message');
    var resultsContainer = document.getElementById('results-container');
    var loadingIndicator = document.getElementById('loading-indicator');
    var targetProductName = document.getElementById('target-product-name');
    var recommendationsList = document.getElementById('recommendations-list');
    
    // Karena frontend sekarang disajikan oleh backend, kita gunakan relative path
    var BASE_URL = '';
    
    var myChart = null;

    ambilDataProduk();
    ambilDataStats();
    ambilDataBestsellers();
    ambilDataBundles();

    function ambilDataProduk() {
        fetch(BASE_URL + '/api/products')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                productSelect.innerHTML = '<option value="">-- Pilih Produk Target --</option>';
                for (var i = 0; i < data.products.length; i++) {
                    var opt = document.createElement('option');
                    opt.value = data.products[i];
                    opt.innerHTML = data.products[i];
                    productSelect.appendChild(opt);
                }
            })
            .catch(function(error) {
                console.error('Gagal mengambil produk:', error);
                productSelect.innerHTML = '<option value="">Server Error</option>';
            });
    }

    function ambilDataStats() {
        fetch(BASE_URL + '/api/stats')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                document.getElementById('kpi-products').innerText = data.total_products.toLocaleString('id-ID');
                document.getElementById('kpi-rules').innerText = data.total_rules.toLocaleString('id-ID');
            })
            .catch(function(error) {
                console.error('Gagal mengambil stats:', error);
            });
    }

    function ambilDataBestsellers() {
        fetch(BASE_URL + '/api/top-bestsellers')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                window.bestsellerList = data.bestsellers;
                var ul = document.getElementById('bestseller-list');
                ul.innerHTML = '';
                for (var i = 0; i < data.bestsellers.length; i++) {
                    var li = document.createElement('li');
                    li.innerText = data.bestsellers[i];
                    ul.appendChild(li);
                }
            })
            .catch(function(error) {
                console.error('Gagal mengambil bestsellers:', error);
            });
    }

    function ambilDataBundles() {
        fetch(BASE_URL + '/api/top-bundles')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                var tbody = document.getElementById('bundles-tbody');
                tbody.innerHTML = '';
                for (var i = 0; i < data.bundles.length; i++) {
                    var b = data.bundles[i];
                    var tr = document.createElement('tr');
                    
                    var tdAnt = document.createElement('td');
                    tdAnt.innerHTML = '<strong>' + b.antecedents.join(', ') + '</strong>';
                    
                    var tdCons = document.createElement('td');
                    tdCons.innerHTML = '<span class="text-green"><strong>' + b.consequents.join(', ') + '</strong></span>';
                    
                    var tdConf = document.createElement('td');
                    tdConf.style.textAlign = 'right';
                    tdConf.innerText = (b.confidence * 100).toFixed(1) + '%';
                    
                    var tdLift = document.createElement('td');
                    tdLift.style.textAlign = 'right';
                    tdLift.innerHTML = '<strong>' + b.lift.toFixed(2) + 'x</strong>';
                    
                    tr.appendChild(tdAnt);
                    tr.appendChild(tdCons);
                    tr.appendChild(tdConf);
                    tr.appendChild(tdLift);
                    
                    tbody.appendChild(tr);
                }
            })
            .catch(function(error) {
                console.error('Gagal mengambil bundles:', error);
                document.getElementById('bundles-tbody').innerHTML = '<tr><td colspan="4" style="text-align: center;">Gagal memuat data bundling.</td></tr>';
            });
    }

    btnAnalyze.addEventListener('click', function() {
        var produkPilihan = productSelect.value;
        if (produkPilihan === "") {
            alert('Silakan pilih produk terlebih dahulu!');
            return;
        }

        welcomeMessage.style.display = 'none';
        resultsContainer.style.display = 'none';
        loadingIndicator.style.display = 'block';

        var payload = {
            product_name: produkPilihan,
            algorithm: document.getElementById('algorithm-select').value,
            min_support: parseFloat(minSupportSlider.value),
            min_confidence: parseFloat(minConfidenceSlider.value),
            top_n: 6
        };

        fetch(BASE_URL + '/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            loadingIndicator.style.display = 'none';
            if (data.recommendations && data.recommendations.length > 0) {
                tampilkanHasil(data.product, data.recommendations);
            } else {
                welcomeMessage.style.display = 'block';
                welcomeMessage.querySelector('.status-title').innerText = 'Tidak Ada Pola';
                welcomeMessage.querySelector('.status-text').innerHTML = 'Produk ini tidak memiliki hubungan belanja yang cukup kuat dengan produk lain berdasarkan minimum support & confidence yang ditetapkan.<br><br><small style="color: #64748b;">Debug Payload: ' + JSON.stringify(payload) + '<br>Debug Response: ' + JSON.stringify(data) + '</small>';
            }
        })
        .catch(function(error) {
            loadingIndicator.style.display = 'none';
            alert('Gagal mengambil rekomendasi. Pastikan Backend menyala.');
        });
    });

    function tampilkanHasil(namaProduk, daftarRekomendasi) {
        targetProductName.innerText = namaProduk.toUpperCase();
        resultsContainer.style.display = 'block';
        recommendationsList.innerHTML = '';

        var labelGrafik = [];
        var dataConfidence = [];
        var dataLift = [];

        var topRec = daftarRekomendasi[0];
        var insightText = "";
        
        if (topRec.lift > 2.0 && topRec.confidence > 0.25) {
            insightText = "Saran Promosi Bundling: Produk " + namaProduk + " memiliki daya tarik (Lift) yang sangat kuat terhadap " + topRec.product + " sebesar " + topRec.lift.toFixed(1) + " kali lipat. Jadikan " + namaProduk + " sebagai umpan utama dan berikan diskon khusus untuk " + topRec.product + " jika dibeli secara bersamaan.";
        } else if (topRec.confidence > 0.20) {
            insightText = "Saran Tata Letak (Store Layout): Cukup banyak pelanggan (" + (topRec.confidence * 100).toFixed(0) + "%) yang membeli " + namaProduk + " juga akan membeli " + topRec.product + ". Direkomendasikan untuk menempatkan kedua produk ini berdekatan di rak toko atau di halaman katalog yang sama.";
        } else if (topRec.lift > 1.2) {
            insightText = "Saran Manajemen Stok: Terdapat pola pembelian komplementer antara " + namaProduk + " dan " + topRec.product + ". Pastikan ketersediaan stok " + topRec.product + " dijaga pada batas aman ketika " + namaProduk + " sedang dipromosikan.";
        } else {
            insightText = "Saran Pemasaran Kasir: Walaupun hubungannya tidak terlalu kuat, " + topRec.product + " dapat ditawarkan sebagai barang rekomendasi tambahan saat pelanggan berada di kasir untuk meningkatkan nilai transaksi rata-rata.";
        }
        
        document.getElementById('business-insight-text').innerText = insightText;
        document.getElementById('business-insight-panel').style.display = 'block';

        for (var i = 0; i < daftarRekomendasi.length; i++) {
            var rec = daftarRekomendasi[i];
            
            var divItem = document.createElement('div');
            divItem.className = 'rec-item';
            
            var html = '<h4>' + rec.product + '</h4>';
            html += '<table class="data-table">';
            html += '<tr><td class="data-label">Confidence</td><td class="data-value">' + (rec.confidence * 100).toFixed(1) + '%</td></tr>';
            html += '<tr><td class="data-label">Nilai Lift</td><td class="data-value text-green">' + rec.lift.toFixed(2) + 'x</td></tr>';
            html += '<tr><td class="data-label">Support</td><td class="data-value">' + (rec.support * 100).toFixed(2) + '%</td></tr>';
            html += '</table>';
            
            divItem.innerHTML = html;
            recommendationsList.appendChild(divItem);

            labelGrafik.push(rec.product.length > 15 ? rec.product.substring(0, 15) + '...' : rec.product);
            dataConfidence.push(rec.confidence * 100);
            dataLift.push(rec.lift);
        }

        buatGrafik(labelGrafik, dataConfidence, dataLift);
    }

    function buatGrafik(labels, confidence, lift) {
        var ctx = document.getElementById('myChart').getContext('2d');
        if (myChart != null) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Confidence (%)',
                        data: confidence,
                        backgroundColor: '#2563eb', // primary blue
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Nilai Lift (x)',
                        data: lift,
                        backgroundColor: '#10b981', // green accent
                        borderRadius: 4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '500' } }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Confidence (%)' },
                        grid: { color: '#e2e8f0' },
                        ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Lift Value' },
                        grid: { drawOnChartArea: false },
                        ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } }
                    }
                },
                plugins: {
                    legend: { labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '500' } } }
                }
            }
        });
    }
});
