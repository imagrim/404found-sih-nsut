import os
import sys
import subprocess
import json
import asyncio
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Adjust path to import database helpers
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from backend.database import (
    get_index_history,
    get_raw_flights,
    get_anomalies,
    get_overrides,
    get_settings,
    save_settings,
    add_override
)
from scraper.pipeline import run_pipeline

app = FastAPI(
    title="MoSPI Airfare Price Indexing Service",
    description="NSO statistical computation engine for augmenting Consumer Price Index (CPI) airfares."
)

@app.on_event("startup")
def startup_event():
    # Automatically seed and calculate index on boot if database is fresh
    try:
        run_pipeline()
    except Exception as e:
        print(f"Error executing startup database seeder: {e}")

# Enable CORS for React Frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, lock down to dashboard domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/index-history")
def read_index_history():
    history = get_index_history()
    return history

@app.get("/api/raw-flights")
def read_raw_flights():
    flights = get_raw_flights(limit=10000)
    return flights

@app.get("/api/anomalies")
def read_anomalies():
    anomalies = get_anomalies()
    return anomalies

@app.get("/api/overrides")
def read_overrides():
    return get_overrides()

@app.post("/api/override")
def apply_override(payload: dict = Body(...)):
    flight_id = payload.get("flightId")
    action = payload.get("action")
    manual_price = payload.get("manualPrice")
    notes = payload.get("notes")
    
    if not flight_id or not action:
        raise HTTPException(status_code=400, detail="Missing flightId or action parameter")
        
    price_val = int(manual_price) if manual_price is not None else None
    
    # Commit override to SQLite
    add_override(flight_id, action, price_val, notes)
    
    # Recalculate pipeline indexes natively without blocking VM startup
    try:
        run_pipeline()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to recalculate index pipeline: {e}")
    
    return {
        "success": True, 
        "message": "Outlier override authorized and Consumer Price Index (CPI) updated."
    }

@app.post("/api/settings")
def update_settings(payload: dict = Body(...)):
    route_weights = payload.get("routeWeights")
    window_weights = payload.get("windowWeights")
    formula = payload.get("formula")
    
    save_settings(route_weights, window_weights, formula)
    
    # Trigger pipeline recalculation natively
    try:
        run_pipeline()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")
    
    return {"success": True, "message": "CPI basket settings updated and recalculated."}

@app.get("/api/stream-scraper-logs")
async def stream_scraper_logs():
    """
    Spawns the Playwright stealth live scraper and cleaning pipeline asynchronously,
    streaming logs in real-time as Server-Sent Events (SSE).
    """
    async def log_generator():
        scraper_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'scraper', 'stealth_scraper.py')
        pipeline_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'scraper', 'pipeline.py')
        python_exe = sys.executable
        
        yield f"data: {json.dumps({'type': 'sys', 'message': 'Booting Playwright Stealth Engine...' })}\n\n"
        yield f"data: {json.dumps({'type': 'sys', 'message': f'Executing Live Web Scraping: {python_exe} scraper/stealth_scraper.py DEL-BOM 15' })}\n\n"
        
        # 1. Run live scraper child process asynchronously
        scraper_proc = await asyncio.create_subprocess_exec(
            python_exe, scraper_path, "DEL-BOM", "15",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        
        # Stream stdout line by line asynchronously
        while True:
            line_bytes = await scraper_proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode('utf-8', errors='replace').strip()
            if line:
                yield f"data: {json.dumps({'type': 'log', 'message': line})}\n\n"
                await asyncio.sleep(0.01) # Yield to event loop
                
        await scraper_proc.wait()
        
        yield f"data: {json.dumps({'type': 'sys', 'message': f'Live crawler finished with exit code {scraper_proc.returncode}'})}\n\n"
        yield f"data: {json.dumps({'type': 'sys', 'message': f'Triggering anomaly cleaning and index construction: {python_exe} scraper/pipeline.py'})}\n\n"
        
        # 2. Run index calculation pipeline child process asynchronously
        pipeline_proc = await asyncio.create_subprocess_exec(
            python_exe, pipeline_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        
        while True:
            line_bytes = await pipeline_proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode('utf-8', errors='replace').strip()
            if line:
                yield f"data: {json.dumps({'type': 'pipeline', 'message': line})}\n\n"
                await asyncio.sleep(0.01) # Yield to event loop
                
        await pipeline_proc.wait()
        
        yield f"data: {json.dumps({'type': 'sys', 'message': 'Recalculation finished!'})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'message': 'Aggregated daily APIx indexed.'})}\n\n"

    return StreamingResponse(log_generator(), media_type="text/event-stream")

# Start validation trigger
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3001)
