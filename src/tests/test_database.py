import sys
import os
import sqlite3

# Adjust path to find backend modules
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from backend.database import (
    get_db_connection,
    init_db,
    save_flights,
    get_raw_flights,
    add_override,
    get_overrides,
    save_settings,
    get_settings
)

# Use a test database path to avoid polluting the development DB
TEST_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
TEST_DB_PATH = os.path.join(TEST_DB_DIR, 'airfare_cpi_test.db')

def setup_module(module):
    # Temporarily override database path for tests
    import backend.database as db
    db.DB_PATH = TEST_DB_PATH
    db.init_db()

def teardown_module(module):
    # Clean up the test database file
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except PermissionError:
            pass

def test_database_initialization():
    # Verify that the test database has tables
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    assert "flights" in tables
    assert "index_history" in tables
    assert "overrides" in tables
    assert "settings" in tables

def test_save_and_retrieve_flights():
    mock_flight = {
        "id": "TEST_6E-101_2026-09-01_7",
        "flight_number": "6E-101",
        "origin": "DEL",
        "destination": "BOM",
        "carrier": "IndiGo",
        "days_ahead": 7,
        "departure_date": "2026-09-01",
        "base_fare": 4000,
        "taxes": 500,
        "udf": 400,
        "convenience_fee": 350,
        "total_fare": 5250,
        "scraped_at": "2026-08-25T12:00:00",
        "status": "clean"
    }
    
    save_flights([mock_flight])
    
    flights = get_raw_flights(limit=10)
    assert len(flights) >= 1
    
    retrieved = [f for f in flights if f['id'] == "TEST_6E-101_2026-09-01_7"]
    assert len(retrieved) == 1
    assert retrieved[0]['flight_number'] == "6E-101"
    assert retrieved[0]['total_fare'] == 5250

def test_manual_override_exclusion():
    flight_id = "TEST_6E-101_2026-09-01_7"
    add_override(flight_id, action="exclude", manual_price=None, notes="Excluding flight due to anomaly", operator="Tester")
    
    # Check overrides table
    overrides = get_overrides()
    assert len(overrides) >= 1
    assert overrides[0]['flight_id'] == flight_id
    assert overrides[0]['action'] == "exclude"
    
    # Check flight status updated to excluded
    flights = get_raw_flights(limit=10)
    retrieved = [f for f in flights if f['id'] == flight_id]
    assert retrieved[0]['status'] == "excluded"

def test_save_and_get_settings():
    route_w = {"DEL-BOM": 50, "DEL-BLR": 50}
    window_w = {1: 40, 7: 60}
    formula = "laspeyres"
    
    save_settings(route_w, window_w, formula)
    
    settings = get_settings()
    assert settings is not None
    assert settings['formula'] == "laspeyres"
    assert settings['route_weights']['DEL-BOM'] == 50
