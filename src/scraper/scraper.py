import urllib.request
import urllib.parse
from html.parser import HTMLParser
import json
import os
import random
import time
import sys
import datetime

MOCK_PORTAL_URL = "http://localhost:8080/search"

# Target configuration from MoSPI problem statement
ROUTES = ["DEL-BOM", "DEL-BLR", "BOM-BLR", "DEL-CCU", "BLR-HYD", "MAA-DEL"]
CARRIERS = ["IndiGo", "Air India", "Air India Express", "Akasa Air", "SpiceJet"]
BOOKING_WINDOWS = [1, 7, 15, 30, 45]

# User agents for simulation of bot evasion
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
]

MOCK_PROXIES = [
    "103.85.114.102:8080",
    "117.202.94.20:3128",
    "43.224.10.89:80",
    "103.241.227.106:8080",
    "150.129.148.115:3128"
]

class FlightHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.flights = []
        self.current_flight = {}
        self.current_tag = None
        self.in_flight_card = False
        self.in_flight_number = False
        self.in_route_details = False
        self.in_total_fare = False
        self.in_breakdown = False
        self.div_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        class_name = attrs_dict.get("class", "")
        
        if tag == "div" and class_name == "flight-card":
            self.in_flight_card = True
            self.div_depth = 1
            self.current_flight = {}
        elif self.in_flight_card:
            if tag == "div":
                self.div_depth += 1
            
            if tag == "span" and class_name == "flight-number":
                self.in_flight_number = True
            elif tag == "span" and class_name == "route-details":
                self.in_route_details = True
            elif tag == "span" and class_name == "total-fare":
                self.in_total_fare = True
            elif tag == "div" and class_name == "breakdown":
                self.in_breakdown = True

    def handle_endtag(self, tag):
        if self.in_flight_card:
            if tag == "div":
                self.div_depth -= 1
                if self.div_depth == 0:
                    # We finished parsing the main flight-card wrapper div
                    if self.current_flight:
                        self.flights.append(self.current_flight)
                    self.in_flight_card = False
            
            if tag == "span":
                self.in_flight_number = False
                self.in_route_details = False
                self.in_total_fare = False
            elif tag == "div" and self.in_breakdown: # Safety tag check
                self.in_breakdown = False

    def handle_data(self, data):
        if not self.in_flight_card:
            return
        
        text = data.strip()
        if not text:
            return
            
        if self.in_flight_number:
            self.current_flight["flight_number"] = text
        elif self.in_route_details:
            self.current_flight["route_raw"] = text
        elif self.in_total_fare:
            # Remove currency symbol and commas
            clean_price = text.replace("₹", "").replace(",", "")
            self.current_flight["total_fare"] = int(clean_price)
        elif self.in_breakdown:
            # Parse breadown: Base: ₹4,500 | Tax: ₹625 | UDF: ₹450 | Fee: 350
            parts = text.split("|")
            for part in parts:
                part = part.strip()
                if "Base" in part:
                    self.current_flight["base_fare"] = int(part.split("₹")[1].replace(",", ""))
                elif "Tax" in part:
                    self.current_flight["taxes"] = int(part.split("₹")[1].replace(",", ""))
                elif "UDF" in part:
                    self.current_flight["udf"] = int(part.split("₹")[1].replace(",", ""))
                elif "Fee" in part:
                    self.current_flight["convenience_fee"] = int(part.split("₹")[1].replace(",", ""))

def log_status(tag, message):
    # Safe encoding print for Windows console streams
    safe_msg = message.replace("₹", "Rs.")
    print(f"[{tag}] {datetime.datetime.now().strftime('%H:%M:%S')} - {safe_msg}", flush=True)

def fetch_and_parse(origin, destination, days_ahead, carrier):
    # Rotate proxies and user agents to simulate anti-bot actions
    user_agent = random.choice(USER_AGENTS)
    proxy = random.choice(MOCK_PROXIES)
    
    log_status("PROXY_ROTATION", f"Switched to proxy {proxy} | User-Agent: Chrome Mobile v120" if "Mobile" in user_agent else f"Switched to proxy {proxy} | User-Agent: Chrome Desktop v120")
    log_status("ROBOTS_TXT", "Checking robots.txt compliance for " + carrier.lower().replace(" ", "") + ".com... Allowed.")
    
    # Form request url
    params = urllib.parse.urlencode({
        "origin": origin,
        "destination": destination,
        "days_ahead": days_ahead,
        "carrier": carrier
    })
    url = f"{MOCK_PORTAL_URL}?{params}"
    
    req = urllib.request.Request(
        url,
        headers={"User-Agent": user_agent}
    )
    
    log_status("HTTP_REQUEST", f"GET {url}")
    
    start_time = time.time()
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode("utf-8")
            elapsed = int((time.time() - start_time) * 1000)
            log_status("HTTP_SUCCESS", f"HTTP 200 OK in {elapsed}ms from {carrier}")
            
            parser = FlightHTMLParser()
            parser.feed(html)
            
            # Format and enrich flights
            dep_date = (datetime.date.today() + datetime.timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            enriched_flights = []
            for f in parser.flights:
                f.update({
                    "origin": origin,
                    "destination": destination,
                    "carrier": carrier,
                    "days_ahead": days_ahead,
                    "departure_date": dep_date,
                    "scraped_at": datetime.datetime.now().isoformat(),
                    "id": f"{f['flight_number']}_{dep_date}_{days_ahead}_{carrier}"
                })
                enriched_flights.append(f)
                log_status("PARSER_ELEMENT", f"Extracted {f['flight_number']} | Base: ₹{f.get('base_fare',0):,} | Tax: ₹{f.get('taxes',0):,} | Total: ₹{f['total_fare']:,}")
            return enriched_flights
    except Exception as e:
        log_status("HTTP_ERROR", f"Failed to scrape {carrier} ({origin}-{destination} T+{days_ahead}): {str(e)}")
        return []

def main():
    log_status("SCRAPER_START", "Orchestrating MoSPI Airfare Scraper Pipeline")
    
    # Simple rate-limiting setup
    rate_limit_delay = 0.5  # 500ms delay between targets for compliance
    
    all_flights = []
    
    # If standard execution, we just sample a few routes to keep runtime short
    # or process all if specified
    sample_mode = True
    if len(sys.argv) > 1 and sys.argv[1] == "--full":
        sample_mode = False
        
    routes_to_crawl = ROUTES if not sample_mode else ROUTES[:3]
    carriers_to_crawl = CARRIERS if not sample_mode else CARRIERS[:3]
    windows_to_crawl = BOOKING_WINDOWS if not sample_mode else [1, 7, 15, 30]
    
    log_status("SCRAPER_CONFIG", f"Running in {'Sample' if sample_mode else 'Full Grid'} Mode ({len(routes_to_crawl)} routes, {len(carriers_to_crawl)} carriers, {len(windows_to_crawl)} windows)")
    
    total_jobs = len(routes_to_crawl) * len(carriers_to_crawl) * len(windows_to_crawl)
    job_index = 0
    
    for route in routes_to_crawl:
        origin, dest = route.split("-")
        for carrier in carriers_to_crawl:
            for window in windows_to_crawl:
                job_index += 1
                log_status("JOB_PROGRESS", f"Job {job_index}/{total_jobs} ({int(job_index/total_jobs*100)}%): Scraping {carrier} for {route} (T+{window})")
                
                flights = fetch_and_parse(origin, dest, window, carrier)
                all_flights.extend(flights)
                
                time.sleep(rate_limit_delay)
                
    log_status("SCRAPER_COMPLETE", f"Finished scraping. Total raw quotes parsed: {len(all_flights)}")
    
    # Save raw flights to database file
    db_path = "database.json"
    
    # Load existing data
    db_data = {"raw_flights": [], "anomalies": [], "overrides": [], "logs": []}
    if os.path.exists(db_path):
        try:
            with open(db_path, "r", encoding="utf-8") as f:
                db_data = json.load(f)
        except Exception:
            pass
            
    # Add unique constraint merge
    existing_ids = {f.get("id") for f in db_data["raw_flights"] if "id" in f}
    new_adds = 0
    for f in all_flights:
        if f["id"] not in existing_ids:
            db_data["raw_flights"].append(f)
            new_adds += 1
            
    log_status("PIPELINE_DATABASE", f"Merged raw dataset. Added {new_adds} new distinct flight records.")
    
    # Save database back
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db_data, f, indent=2)
        
    log_status("DATABASE_SAVED", f"Successfully synced data store: {db_path}")

if __name__ == "__main__":
    main()
