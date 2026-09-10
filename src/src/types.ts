export interface Flight {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  carrier: string;
  days_ahead: number;
  departure_date: string;
  base_fare: number;
  taxes: number;
  udf: number;
  convenience_fee: number;
  total_fare: number;
  scraped_at: string;
}

export interface IndexPoint {
  date: string;
  apix: number;      // Laspeyres Index
  jevons: number;    // Jevons Index
  mom: number;       // Month-on-Month % change
  dgca_benchmark: number; // Back-testing validation data
}

export interface Anomaly extends Flight {
  z_score: number;
  flagged_at: string;
  reason: string;
}

export interface Override {
  flight_id: string;
  action: 'exclude' | 'correct';
  manual_price: number | null;
  notes: string;
  timestamp: string;
  operator: string;
}

export interface ScraperStatus {
  name: string;
  status: 'idle' | 'crawling' | 'parsing' | 'rate-limited' | 'success' | 'error';
  proxy: string;
  successRate: number;
  currentRoute: string;
  currentWindow: number;
}

export interface LogEntry {
  type: 'sys' | 'log' | 'error' | 'pipeline' | 'done';
  message: string;
  timestamp: string;
}
