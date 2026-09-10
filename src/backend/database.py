import sqlite3
import os
import json

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
DB_PATH = os.path.join(DB_DIR, 'airfare_cpi.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Flights table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS flights (
        id TEXT PRIMARY KEY,
        flight_number TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        carrier TEXT NOT NULL,
        days_ahead INTEGER NOT NULL,
        departure_date TEXT NOT NULL,
        base_fare INTEGER NOT NULL,
        taxes INTEGER NOT NULL,
        udf INTEGER NOT NULL,
        convenience_fee INTEGER NOT NULL,
        total_fare INTEGER NOT NULL,
        scraped_at TEXT NOT NULL,
        status TEXT DEFAULT 'clean' -- 'clean', 'anomaly', 'overridden'
    )
    """)
    
    # 2. Index history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS index_history (
        date TEXT PRIMARY KEY,
        apix REAL NOT NULL,
        jevons REAL NOT NULL,
        mom REAL NOT NULL,
        dgca_benchmark REAL NOT NULL
    )
    """)
    
    # 3. Overrides table (Compliance trail)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS overrides (
        flight_id TEXT PRIMARY KEY,
        action TEXT NOT NULL, -- 'exclude', 'correct'
        manual_price INTEGER,
        notes TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        operator TEXT NOT NULL
    )
    """)
    
    # 4. Settings table (to cache weights)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()

# Flight DB helpers
def save_flights(flights):
    conn = get_db_connection()
    cursor = conn.cursor()
    for f in flights:
        cursor.execute("""
        INSERT OR REPLACE INTO flights 
        (id, flight_number, origin, destination, carrier, days_ahead, departure_date, base_fare, taxes, udf, convenience_fee, total_fare, scraped_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f['id'], f['flight_number'], f['origin'], f['destination'], f['carrier'],
            f['days_ahead'], f['departure_date'], f['base_fare'], f['taxes'],
            f['udf'], f['convenience_fee'], f['total_fare'], f['scraped_at'],
            f.get('status', 'clean')
        ))
    conn.commit()
    conn.close()

def get_raw_flights(limit=300):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flights ORDER BY scraped_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_anomalies():
    # Load all flights with outlier status or Z-score > 2.2 criteria
    # Historically, anomalies are also stored
    conn = get_db_connection()
    cursor = conn.cursor()
    # We identify anomalies by searching flights where status = 'anomaly'
    cursor.execute("SELECT * FROM flights WHERE status = 'anomaly' ORDER BY departure_date DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_flight_status(flight_id, status, total_fare=None, base_fare=None, taxes=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if total_fare is not None:
        cursor.execute("""
        UPDATE flights 
        SET status = ?, total_fare = ?, base_fare = ?, taxes = ?
        WHERE id = ?
        """, (status, total_fare, base_fare, taxes, flight_id))
    else:
        cursor.execute("UPDATE flights SET status = ? WHERE id = ?", (status, flight_id))
    conn.commit()
    conn.close()

# Override DB helpers
def add_override(flight_id, action, manual_price, notes, operator='MoSPI Administrator'):
    conn = get_db_connection()
    cursor = conn.cursor()
    import datetime
    timestamp = datetime.datetime.now().isoformat()
    cursor.execute("""
    INSERT OR REPLACE INTO overrides (flight_id, action, manual_price, notes, timestamp, operator)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (flight_id, action, manual_price, notes, timestamp, operator))
    
    # Update corresponding flight status
    status = 'overridden'
    if action == 'exclude':
        cursor.execute("UPDATE flights SET status = 'excluded' WHERE id = ?", (flight_id,))
    else:
        # Corrected price
        base = int(manual_price * 0.8)
        taxes = int(manual_price * 0.2)
        cursor.execute("""
        UPDATE flights 
        SET status = 'overridden', total_fare = ?, base_fare = ?, taxes = ?
        WHERE id = ?
        """, (manual_price, base, taxes, flight_id))
        
    conn.commit()
    conn.close()

def get_overrides():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM overrides ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Index DB helpers
def save_index_history(index_history):
    conn = get_db_connection()
    cursor = conn.cursor()
    for pt in index_history:
        cursor.execute("""
        INSERT OR REPLACE INTO index_history (date, apix, jevons, mom, dgca_benchmark)
        VALUES (?, ?, ?, ?, ?)
        """, (pt['date'], pt['apix'], pt['jevons'], pt['mom'], pt['dgca_benchmark']))
    conn.commit()
    conn.close()

def get_index_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM index_history ORDER BY date ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Settings helpers
def save_settings(route_weights, window_weights, formula):
    conn = get_db_connection()
    cursor = conn.cursor()
    config = {
        'route_weights': route_weights,
        'window_weights': window_weights,
        'formula': formula
    }
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('cpi_config', ?)", (json.dumps(config),))
    conn.commit()
    conn.close()

def get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'cpi_config'")
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row['value'])
    return None

# Auto initialize schema on import
init_db()
