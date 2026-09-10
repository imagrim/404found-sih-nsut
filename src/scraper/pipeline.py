import os
import sys
import datetime
import random
import math

# Adjust python path to import from parent backend directory
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from backend.database import get_db_connection, save_flights, save_index_history, get_settings, add_override
from backend.math_utils import detect_modified_z_score_anomalies, calculate_laspeyres_cpi

DEFAULT_ROUTE_WEIGHTS = {
    "DEL-BOM": 0.30,
    "DEL-BLR": 0.20,
    "BOM-BLR": 0.15,
    "DEL-CCU": 0.15,
    "BLR-HYD": 0.10,
    "MAA-DEL": 0.10
}

DEFAULT_WINDOW_WEIGHTS = {
    1: 0.10,
    7: 0.20,
    15: 0.30,
    30: 0.25,
    45: 0.15
}

CARRIERS = ["IndiGo", "Air India", "Air India Express", "Akasa Air", "SpiceJet"]

def log_status(tag, message):
    # Safe encoding print for Windows console streams
    safe_msg = message.replace("₹", "Rs.")
    print(f"[{tag}] {datetime.datetime.now().strftime('%H:%M:%S')} - {safe_msg}", flush=True)

def seed_database_if_empty():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM flights")
    row = cursor.fetchone()
    count = row['count'] if row else 0
    conn.close()
    
    if count >= 100:
        return
        
    log_status("DATABASE_SEEDING", "SQLite database flights table is empty or low. Seeding 30-day historical quotes...")
    
    today = datetime.date.today()
    seeded_flights = []
    
    # 35 days of historical data to allow index calculation relative to base day
    for i in range(35, -1, -1):
        past_date = today - datetime.timedelta(days=i)
        past_date_str = past_date.strftime("%Y-%m-%d")
        
        # Trend multiplier mimicking fuel price index shifts and weekend demand
        trend_multiplier = 1.0 + 0.05 * math.sin(i / 5.0) + (0.08 if past_date.weekday() >= 5 else 0)
        
        for route, route_w in DEFAULT_ROUTE_WEIGHTS.items():
            origin, dest = route.split("-")
            for carrier in CARRIERS[:3]: # Sample 3 carriers to control database sizes
                for window in [1, 7, 15, 30, 45]:
                    # Seed price standards
                    price_seed = 4200
                    if route in ["DEL-BOM", "MAA-DEL"]: price_seed = 4800
                    elif route in ["DEL-BLR", "DEL-CCU"]: price_seed = 5300
                    elif route == "BLR-HYD": price_seed = 3100
                    
                    # Window multipliers (T+1 very high, T+45 low)
                    win_multiplier = 2.2 if window == 1 else (1.4 if window == 7 else (1.0 if window == 15 else 0.85))
                    base_fare = int(price_seed * win_multiplier * trend_multiplier * random.uniform(0.95, 1.05))
                    
                    # Inject standard anomalies in history (e.g. heavy weather disrupt or booking surges)
                    is_anomaly = (past_date_str == (today - datetime.timedelta(days=12)).strftime("%Y-%m-%d") and route == "DEL-BOM" and window == 1)
                    if is_anomaly:
                        base_fare = base_fare * 4.2
                        
                    taxes = int(base_fare * 0.05 + 400)
                    udf = 450
                    convenience_fee = 350
                    total_fare = base_fare + taxes + udf + convenience_fee
                    
                    f_id = f"SYN_{carrier[:2]}_{route}_{window}_{past_date_str}"
                    flight = {
                        "id": f_id,
                        "flight_number": f"{carrier[:2].upper()}-{random.randint(100, 999)}",
                        "origin": origin,
                        "destination": dest,
                        "carrier": carrier,
                        "days_ahead": window,
                        "departure_date": past_date_str,
                        "base_fare": base_fare,
                        "taxes": taxes,
                        "udf": udf,
                        "convenience_fee": convenience_fee,
                        "total_fare": total_fare,
                        "scraped_at": (past_date - datetime.timedelta(hours=random.randint(1,5))).isoformat(),
                        "status": "anomaly" if is_anomaly else "clean"
                    }
                    
                    seeded_flights.append(flight)
                    
    save_flights(seeded_flights)
    log_status("DATABASE_SEEDING", f"Seeded {len(seeded_flights)} relational flight quote entries successfully.")

def run_pipeline():
    log_status("PIPELINE_START", "Running relational CPI calculation pipeline")
    
    # Initialize seed datasets
    seed_database_if_empty()
    
    # Load all flight quotes from SQLite
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flights")
    rows = cursor.fetchall()
    conn.close()
    
    flights = [dict(row) for row in rows]
    
    log_status("PIPELINE_CLEANING", f"Analyzing {len(flights)} flight fares for outliers using Modified Z-score (MAD)...")
    
    # Perform outlier detection
    cleaned_flights, anomalies = detect_modified_z_score_anomalies(flights)
    log_status("PIPELINE_CLEANING", f"Isolation results: Clean={len(cleaned_flights)}, Outliers Isolated={len(anomalies)}")
    
    # Update status in DB
    # We update flights flagged as anomalies to 'anomaly'
    conn = get_db_connection()
    cursor = conn.cursor()
    for anom in anomalies:
        cursor.execute("UPDATE flights SET status = 'anomaly' WHERE id = ? AND status != 'overridden'", (anom['id'],))
    conn.commit()
    conn.close()
    
    # Load user weights configuration from settings or load defaults
    config = get_settings()
    route_weights = DEFAULT_ROUTE_WEIGHTS
    window_weights = DEFAULT_WINDOW_WEIGHTS
    formula = 'laspeyres'
    
    if config:
        route_weights = config.get('route_weights', DEFAULT_ROUTE_WEIGHTS)
        window_weights = config.get('window_weights', DEFAULT_WINDOW_WEIGHTS)
        formula = config.get('formula', 'laspeyres')
        log_status("PIPELINE_CONFIG", "Loaded custom CPI weighting specifications from SQL records.")
    else:
        log_status("PIPELINE_CONFIG", "Using default MoSPI passenger grid weights.")
        
    # Calculate index history on clean and overridden flights (ignoring excluded)
    conn = get_db_connection()
    cursor = conn.cursor()
    # Pull overrides that are exclusions
    cursor.execute("SELECT flight_id FROM overrides WHERE action = 'exclude'")
    excluded_ids = {row['flight_id'] for row in cursor.fetchall()}
    conn.close()
    
    final_flights = [f for f in flights if f['id'] not in excluded_ids and f['status'] != 'anomaly']
    
    # Load overridden corrections
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM overrides WHERE action = 'correct'")
    corrections = {row['flight_id']: row['manual_price'] for row in cursor.fetchall()}
    conn.close()
    
    for f in final_flights:
        if f['id'] in corrections:
            f['total_fare'] = corrections[f['id']]
            
    log_status("INDEX_CALCULATION", f"Running index formulas (Standard: {formula.upper()})...")
    index_history = calculate_laspeyres_cpi(final_flights, route_weights, window_weights, formula)
    
    # Persist calculated indices
    save_index_history(index_history)
    
    log_status("PIPELINE_COMPLETE", f"Index generated successfully. Latest APIx Index: {index_history[-1]['apix']}")

if __name__ == "__main__":
    run_pipeline()
