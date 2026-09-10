import http.server
import socketserver
import urllib.parse
import random
import datetime

PORT = 8080

# Base configuration matching SIH specifications
ROUTES = ["DEL-BOM", "DEL-BLR", "BOM-BLR", "DEL-CCU", "BLR-HYD", "MAA-DEL"]
CARRIERS = ["IndiGo", "Air India", "Air India Express", "Akasa Air", "SpiceJet"]

HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <title>Mock Flight Search Results - {carrier}</title>
    <style>
        body {{ font-family: Arial, sans-serif; background: #f4f6f9; color: #333; margin: 0; padding: 20px; }}
        .header {{ background: #0f172a; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
        .container {{ max-width: 800px; margin: 0 auto; }}
        .flight-card {{ background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
        .flight-info {{ display: flex; flex-direction: column; }}
        .flight-number {{ font-weight: bold; color: #1e3a8a; font-size: 1.1em; }}
        .route-details {{ color: #64748b; margin-top: 5px; }}
        .fare-details {{ text-align: right; }}
        .total-fare {{ font-size: 1.4em; font-weight: bold; color: #0f172a; }}
        .breakdown {{ font-size: 0.8em; color: #64748b; margin-top: 3px; }}
        .fare-class {{ display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; margin-top: 5px; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>{carrier} Booking Portal</h2>
            <p>Route: <strong>{origin} &rarr; {destination}</strong> | Departure: {dep_date} ({days_ahead} days advance booking)</p>
            <p id="robots-compliance">Robots.txt Allowed | Scraping Rate Limit: 10 requests/min</p>
        </div>
        
        <div class="flight-list">
            {flights_html}
        </div>
    </div>
</body>
</html>
"""

class MockAirlineHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # Only serve the flight search page
        if parsed_url.path == "/search":
            query = urllib.parse.parse_qs(parsed_url.query)
            
            origin = query.get("origin", ["DEL"])[0]
            destination = query.get("destination", ["BOM"])[0]
            carrier = query.get("carrier", ["IndiGo"])[0]
            try:
                days_ahead = int(query.get("days_ahead", [7])[0])
            except ValueError:
                days_ahead = 7
                
            dep_date = (datetime.date.today() + datetime.timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            
            # Generate 3-5 flight listings dynamically
            num_flights = random.randint(3, 5)
            flights_html = ""
            
            # Seed based on origin-destination-days_ahead-carrier for deterministic pseudo-random outputs
            random.seed(hash(f"{origin}-{destination}-{days_ahead}-{carrier}"))
            
            # Determine base fare level based on route
            route_base = 3500
            if f"{origin}-{destination}" in ["DEL-BOM", "MAA-DEL"]:
                route_base = 4000
            elif f"{origin}-{destination}" in ["DEL-BLR", "DEL-CCU"]:
                route_base = 4500
            elif f"{origin}-{destination}" == "BLR-HYD":
                route_base = 2500
                
            # Booking window elasticity curve:
            # T+1 is very expensive (+150% to +300% markup)
            # T+7 is moderately expensive (+50% markup)
            # T+15 is standard
            # T+30 is cheap (-10%)
            # T+45 is early bird discount (-20%)
            if days_ahead <= 1:
                multiplier = random.uniform(2.0, 3.5)
            elif days_ahead <= 7:
                multiplier = random.uniform(1.3, 1.8)
            elif days_ahead <= 15:
                multiplier = random.uniform(0.95, 1.15)
            elif days_ahead <= 30:
                multiplier = random.uniform(0.85, 0.95)
            else:
                multiplier = random.uniform(0.75, 0.85)
                
            # Carrier modifier
            carrier_mod = 1.0
            if carrier == "Air India":
                carrier_mod = 1.15  # Full service standard
            elif carrier == "Air India Express" or carrier == "SpiceJet":
                carrier_mod = 0.90  # Ultra-low-cost
            elif carrier == "Akasa Air":
                carrier_mod = 0.92
                
            for i in range(num_flights):
                flight_no = f"{carrier[:2].upper()}-{random.randint(100, 999)}"
                dep_time = f"{random.randint(5, 22):02d}:{random.choice([0, 15, 30, 45]):02d}"
                
                # Base Fare calculation
                base_fare = int(route_base * multiplier * carrier_mod * random.uniform(0.9, 1.1))
                
                # Dynamic outlier injection:
                # 2% chance of injecting a massive price spike (e.g. system glitch or surge)
                # to test the data cleaning pipeline Z-score logic.
                is_anomaly = random.random() < 0.03
                if is_anomaly:
                    base_fare = base_fare * random.choice([5, 8, 12])  # Extreme spike
                    
                # Taxes and UDF (User Development Fee) structure
                taxes = int(base_fare * 0.05 + 400)  # 5% GST + fixed passenger service fee
                udf = random.choice([250, 450, 600]) # Airport User Development Fee
                convenience_fee = 350
                
                total_fare = base_fare + taxes + udf + convenience_fee
                
                flights_html += f"""
                <div class="flight-card">
                    <div class="flight-info">
                        <span class="flight-number">{flight_no}</span>
                        <span class="route-details">{origin} &rarr; {destination} | Departure: {dep_time}</span>
                        <span class="fare-class">Economy (Promo)</span>
                    </div>
                    <div class="fare-details">
                        <span class="total-fare">₹{total_fare:,}</span>
                        <div class="breakdown">
                            Base: ₹{base_fare:,} | Tax: ₹{taxes:,} | UDF: ₹{udf:,} | Fee: ₹{convenience_fee}
                        </div>
                    </div>
                </div>
                """
                
            response_content = HTML_TEMPLATE.format(
                carrier=carrier,
                origin=origin,
                destination=destination,
                dep_date=dep_date,
                days_ahead=days_ahead,
                flights_html=flights_html
            )
            
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(response_content.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Mock portal search is at /search")

if __name__ == "__main__":
    # Standard server launch code
    handler = MockAirlineHandler
    # Enable socket reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Mock Airline Search Server started on port {PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Stopping mock portal server...")
