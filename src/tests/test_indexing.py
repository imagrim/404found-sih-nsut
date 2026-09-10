import sys
import os
import math

# Adjust path to find backend modules
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from backend.math_utils import (
    jevons_mean,
    calculate_mad,
    detect_modified_z_score_anomalies,
    calculate_laspeyres_cpi,
    compute_pearson_correlation,
    compute_rmse
)

def test_jevons_mean():
    # Test simple values: geometric mean of 2 and 8 is sqrt(16) = 4
    prices = [2.0, 8.0]
    assert math.isclose(jevons_mean(prices), 4.0)
    
    # Test empty returns 0.0
    assert jevons_mean([]) == 0.0

def test_calculate_mad():
    # Test simple values: list [2, 4, 6, 8, 10]
    # Median is 6
    # Deviations from median: [|2-6|, |4-6|, |6-6|, |8-6|, |10-6|] = [4, 2, 0, 2, 4]
    # Sorted deviations: [0, 2, 2, 4, 4] -> Median deviation (MAD) is 2
    prices = [2.0, 4.0, 6.0, 8.0, 10.0]
    med = 6.0
    assert math.isclose(calculate_mad(prices, med), 2.0)

def test_detect_modified_z_score_anomalies():
    # Create a small cohort of normal flights and 1 massive outlier
    normal_flights = [
        {"id": f"F{i}", "origin": "DEL", "destination": "BOM", "days_ahead": 7, "carrier": "IndiGo", "total_fare": 5000 + i*100}
        for i in range(5)
    ]
    outlier_flight = {
        "id": "OUTLIER", "origin": "DEL", "destination": "BOM", "days_ahead": 7, "carrier": "IndiGo", "total_fare": 95000 # Massive surge spike
    }
    
    all_flights = normal_flights + [outlier_flight]
    
    cleaned, anomalies = detect_modified_z_score_anomalies(all_flights)
    
    # The outlier flight should be isolated as an anomaly
    assert len(anomalies) == 1
    assert anomalies[0]["id"] == "OUTLIER"
    
    # Normal flights should remain in the clean category
    assert len(cleaned) == 5
    assert all(f["status"] == "clean" for f in cleaned)

def test_compute_pearson_correlation():
    # Perfect positive correlation
    series_a = [100.0, 102.0, 104.0, 106.0]
    series_b = [50.0, 51.0, 52.0, 53.0]
    assert math.isclose(compute_pearson_correlation(series_a, series_b), 1.0)
    
    # Zero correlation
    series_c = [100.0, 100.0, 100.0, 100.0]
    assert compute_pearson_correlation(series_a, series_c) == 0.0

def test_compute_rmse():
    series_a = [100.0, 102.0, 105.0]
    series_b = [98.0, 103.0, 104.0]
    # errors: a - b = [2, -1, 1] -> squared = [4, 1, 1] -> sum = 6 -> mean = 2 -> sqrt(2) = 1.4142
    assert math.isclose(compute_rmse(series_a, series_b), math.sqrt(2.0))
