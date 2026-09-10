# MoSPI Real-Time Airfare Price Index (APIx)

Augmenting India's Consumer Price Index (CPI) with high-frequency civil aviation tariff intelligence.

---

## 1. Project Information

- **Project Title:** APIx – Real-Time Airfare Inflation Analytics & CPI Indexing Engine
- **PS ID:** SIH2026-MOSPI-001
- **PS Title:** Automated Web Scraping & Real-Time Airfare Consumer Price Index (CPI) Analytics Engine
- **Category:** Software
- **Theme:** Fintech / Smart Governance & Sovereign Analytics

---

## 2. Problem Statement

India's Consumer Price Index (CPI) relies on static, monthly manual quotes for domestic airfares. Because airlines use dynamic pricing algorithms, traditional data collection misses advance-booking variations (T+1 to T+90), festival surges, and volume distributions. 

This results in data latency, statistical bias, and delayed inflation insights for regulatory bodies like the Ministry of Statistics and Programme Implementation (MoSPI), the Reserve Bank of India (RBI), and the Ministry of Civil Aviation (MoCA).

## 3. Proposed Solution

APIx (Airfare Price Index) is an automated, real-time web scraping and statistical intelligence platform. 

It continuously ingests flight prices across multiple booking windows, removes price surge noise through robust outlier detection (Modified Z-Score using Median Absolute Deviation), and calculates weighted CPI indices using chained Laspeyres formulas to feed live analytics, reports, and regulatory APIs to government agencies.

## 4. Key Features

- **Real-Time Automated Scraping:** Ingests flight quotes across multiple advance-booking windows (T+1 to T+90) with anti-bot stealth protection.
- **Econometric CPI Engine:** Computes real-time weighted airfare inflation metrics aligned with IMF and NSO statistical standards.
- **Anomaly Governance Hub:** Automatically flags pricing anomalies with audit trail controls for statisticians.
- **Dynamic Policy Simulator:** Allows policy analysts to calibrate route weights and booking parameters for scenario modeling.
- **Live Dashboard & Gazette Export:** Features real-time price tickers, interactive trend charts, and automated gazette generation.

## 5. Expected Impact

- **Real-Time Visibility:** Replaces slow monthly sampling with continuous, high-frequency airfare inflation tracking.
- **Higher Precision:** Eliminates dynamic pricing noise to deliver accurate, tamper-proof CPI data.
- **Proactive Policymaking:** Empowers the RBI and MoCA to detect fare spikes early and make timely economic decisions.

---

## 6. Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Lucide Icons, Vanilla CSS
- **Backend API:** Python 3.10+, FastAPI, Uvicorn, Asyncio (Server-Sent Events)
- **Data Ingestion:** Playwright (headless browser automation), Urllib
- **Database:** SQLite3 (`airfare_cpi.db`)
- **Econometric & Statistical Engine:** Modified Z-Score (Boris Iglewicz & David Hoaglin MAD), Laspeyres & Jevons Index Formulations
- **Testing:** Pytest, Oxlint

---

## 7. System Architecture

A detailed description of the components, data lifecycle, and the 7-step statistical cleaning pipeline is available in [docs/architecture.md](docs/architecture.md).

```text
Input Parameters (Routes & Windows)
                |
                v
Interactive Dashboard (React 19 + Vite) <---> FastAPI Backend Bridge (REST + SSE)
                                                        |
                                                        v
                                          Stealth Scraper Engine (Playwright)
                                                        |
                                                        v
                                          SQLite Relational Storage
                                                        |
                                                        v
                                          7-Step Statistical Cleaning Pipeline
                                          (Median & MAD -> Modified Z-Score -> DGCA Weights)
                                                        |
                                                        v
                                          Official APIx Index & Regulatory Feeds
```

---

## 8. Repository Structure

```text
NSUT-SIH-DEMO-main/
├── README.md                   # Project overview and run guide
├── SUBMISSION_GUIDE.md         # SIH submission checklist
├── requirements.txt            # Python dependencies
├── docs/
│   └── architecture.md         # Technical architecture and econometric formulations
├── submission/
│   ├── PRESENTATION.md         # Final presentation slides (PPTX and Google Slides)
│   └── DEMO.md                 # Demo video link
├── assets/
│   ├── Sih.Final.pptx          # Final presentation file
│   ├── Sih.Final.pdf           # Presentation PDF export
│   └── screenshots/            # UI screenshots and application captures
└── src/
    ├── backend/
    │   ├── main.py             # FastAPI application and SSE logging endpoints
    │   ├── database.py         # SQLite connection, schemas, and queries
    │   └── math_utils.py       # Laspeyres index, Jevons mean, and Modified Z-Score
    ├── scraper/
    │   ├── stealth_scraper.py  # Playwright crawler with anti-bot evasion
    │   ├── mock_portal.py      # Local mock airline booking portal
    │   └── pipeline.py         # Data cleaning and index compilation batch runner
    ├── tests/
    │   ├── test_database.py    # Database integration tests
    │   └── test_indexing.py    # Mathematical and statistical unit tests
    ├── index.html              # Frontend entry point
    ├── package.json            # Node.js dependencies and run scripts
    └── ...
```

---

## 9. Installation & Setup

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher with npm

### 1. Backend Setup

Clone the repository and install the Python dependencies:

```bash
pip install -r requirements.txt
playwright install chromium
```

### 2. Frontend Setup

Install the frontend packages inside the `src/` directory:

```bash
cd src
npm install
```

---

## 10. Running the Application

### Option A: Run Full Stack Concurrently

From the `src/` directory, execute:

```bash
npm run dev
```

This starts both the FastAPI backend on port 3001 and the Vite development server on port 5173 concurrently.

### Option B: Run Services Individually

1. **Start the FastAPI Backend:**

   ```bash
   python src/backend/main.py
   ```
   Backend service runs at `http://127.0.0.1:3001`.

2. **Start the Frontend:**

   ```bash
   cd src
   npm run client
   ```
   Access the dashboard at `http://localhost:5173`.

---

## 11. Running Tests

Execute the statistical and database test suite using Pytest:

```bash
pytest src/tests/
```

---

## 12. Submission Deliverables

- **Presentation:** [submission/PRESENTATION.md](submission/PRESENTATION.md) (includes PPTX, PDF, and Google Slides links)
- **Demo Video:** [submission/DEMO.md](submission/DEMO.md) (Google Drive video link)
- **Architecture Documentation:** [docs/architecture.md](docs/architecture.md)
