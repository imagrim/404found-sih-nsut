import React, { useState, useMemo } from 'react';
import type { Flight, IndexPoint } from '../types';
import { Database, Globe } from 'lucide-react';

interface ApiPlaygroundProps {
  flights: Flight[];
  history: IndexPoint[];
}

export const ApiPlayground: React.FC<ApiPlaygroundProps> = ({ flights, history }) => {
  const [selectedCell, setSelectedCell] = useState<{ route: string; window: number } | null>(null);
  const [apiRoute, setApiRoute] = useState<string>('/api/index-history');
  const [apiResponse, setApiResponse] = useState<string>('');
  const [isCalling, setIsCalling] = useState<boolean>(false);

  const routes = ["DEL-BOM", "DEL-BLR", "BOM-BLR", "DEL-CCU", "BLR-HYD", "MAA-DEL"];
  const windows = [1, 7, 15, 30, 45];

  // 1. Heatmap Grid Data
  const heatmapData = useMemo(() => {
    const data: Record<string, Record<number, { avgFare: number; colorClass: string; flightsList: Flight[] }>> = {};

    for (const r of routes) {
      data[r] = {};
      for (const w of windows) {
        const matching = flights.filter(f => `${f.origin}-${f.destination}` === r && f.days_ahead === w);
        const avg = matching.length > 0 
          ? Math.round(matching.reduce((sum, f) => sum + f.total_fare, 0) / matching.length)
          : 0;

        // Determine price color density class based on relative fare thresholds
        let colorVal = 'rgba(16, 185, 129, 0.8)';
        if (avg > 15000) {
          colorVal = '#ef4444';
        } else if (avg > 9000) {
          colorVal = 'rgba(239, 68, 68, 0.8)';
        } else if (avg > 6000) {
          colorVal = 'rgba(245, 158, 11, 0.8)';
        } else if (avg > 4000) {
          colorVal = 'rgba(59, 130, 246, 0.8)';
        } else if (avg > 0) {
          colorVal = 'rgba(16, 185, 129, 0.8)';
        }

        data[r][w] = { 
          avgFare: avg || (r === 'BLR-HYD' ? 3200 : 5400), // Seeding default fallback
          colorClass: colorVal, 
          flightsList: matching 
        };
      }
    }
    return data;
  }, [flights]);

  // 2. Elasticity Curve Computations (SVG)
  const elasticityPoints = useMemo(() => {
    const curveWidth = 600;
    const curveHeight = 220;
    const padding = 30;

    const windowAverages = windows.map(w => {
      const match = flights.filter(f => f.days_ahead === w);
      const avg = match.length > 0 
        ? match.reduce((sum, f) => sum + f.total_fare, 0) / match.length
        : 0;
      return { window: w, avg: avg || (w === 1 ? 12000 : w === 7 ? 6800 : w === 15 ? 4900 : w === 30 ? 4300 : 3800) };
    });

    const maxAvg = Math.max(...windowAverages.map(d => d.avg));
    const minAvg = Math.min(...windowAverages.map(d => d.avg));
    const range = maxAvg - minAvg || 1;

    const points = windowAverages.map((d, i) => {
      const x = padding + (i / (windows.length - 1)) * (curveWidth - padding * 2);
      const y = curveHeight - padding - ((d.avg - minAvg) / range) * (curveHeight - padding * 2);
      return { x, y, window: d.window, avg: Math.round(d.avg) };
    });

    return { points, width: curveWidth, height: curveHeight, padding };
  }, [flights]);

  // 3. API Playground Simulator
  const handleTestCall = () => {
    setIsCalling(true);
    setTimeout(() => {
      if (apiRoute === '/api/index-history') {
        const slicedHistory = history.length > 0 ? history.slice(-5) : [
          { date: "2026-08-20", apix: 102.3, jevons: 101.9, mom: 0.45, dgca_benchmark: 103.1 },
          { date: "2026-08-21", apix: 102.8, jevons: 102.1, mom: 0.48, dgca_benchmark: 103.5 }
        ];
        setApiResponse(JSON.stringify({
          status: "success",
          source: "MoSPI Data Informatics & Innovation Division",
          metric: "Real-time Airfare Price Index (APIx)",
          base_period: "T_0 (T+45 days pricing baseline)",
          computed_records: history.length,
          data: slicedHistory
        }, null, 2));
      } else {
        const sampleFlights = flights.length > 0 ? flights.slice(0, 3) : [
          { id: "6E-205_2026-08-28_7_IndiGo", flight_number: "6E-205", origin: "DEL", destination: "BOM", carrier: "IndiGo", days_ahead: 7, base_fare: 4800, taxes: 640, total_fare: 5440 }
        ];
        setApiResponse(JSON.stringify({
          status: "success",
          source: "NSO Automated Scraping Engine",
          records_returned: sampleFlights.length,
          flights: sampleFlights
        }, null, 2));
      }
      setIsCalling(false);
    }, 450);
  };

  const curlCommand = `curl -X GET "https://api.mospi.gov.in${apiRoute}" \\
  -H "Accept: application/json" \\
  -H "Authorization: Bearer RBI_NSO_MEMBER_TOKEN_2026"`;

  const selectedCellFlights = useMemo(() => {
    if (!selectedCell) return [];
    return flights.filter(f => `${f.origin}-${f.destination}` === selectedCell.route && f.days_ahead === selectedCell.window);
  }, [selectedCell, flights]);

  return (
    <div>
      <div className="page-header">
        <h2>Economic Analytics & RBI/NSO Integration API</h2>
        <p>Analyze price trends via heatmaps and purchase window elasticities, and manage secure data feeds for national regulators.</p>
      </div>

      <div className="main-dashboard-grid">
        {/* Left Side: Advanced Visualizations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Sector wise price heatmap */}
          <div className="card-panel">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Sector-wise Price Heatmap Grid</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Shows average ticket fare density across booking windows. Click cells to view raw flights matching criteria.
            </p>

            <div className="heatmap-container">
              <div className="heatmap-y-axis">
                {routes.map(r => <span key={r}>{r}</span>)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <span>T+1 d</span>
                  <span>T+7 d</span>
                  <span>T+15 d</span>
                  <span>T+30 d</span>
                  <span>T+45 d</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {routes.map(route => (
                    <div key={route} className="heatmap-grid">
                      {windows.map(win => {
                        const cell = heatmapData[route]?.[win] || { avgFare: 4200, colorClass: '#10b981' };
                        return (
                          <div
                            key={win}
                            className="heatmap-cell"
                            style={{ 
                              background: cell.colorClass,
                              border: selectedCell?.route === route && selectedCell?.window === win ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.05)'
                            }}
                            onClick={() => setSelectedCell({ route, window: win })}
                          >
                            <span>₹{cell.avgFare.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Heatmap Cell Drawer Details */}
            {selectedCell && (
              <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Sect: {selectedCell.route} | T+{selectedCell.window} Days Flight Quotes
                  </span>
                  <button 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                    onClick={() => setSelectedCell(null)}
                  >
                    Clear Filter
                  </button>
                </div>
                {selectedCellFlights.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No live quotes extracted for this specific grid cell. Showing historical defaults.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {selectedCellFlights.map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        <span>{f.carrier} {f.flight_number}</span>
                        <span>Base: ₹{f.base_fare} + Tax: ₹{f.taxes} = <strong>₹{f.total_fare}</strong></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lead-Time Elasticity Curve */}
          <div className="card-panel">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Lead-Time Pricing Elasticity Curve</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Tracks how price elasticity scales inversely with the purchase window. Captures standard market discount spreads.
            </p>

            <div style={{ height: '230px', position: 'relative' }}>
              <svg viewBox={`0 0 ${elasticityPoints.width} ${elasticityPoints.height}`} style={{ width: '100%', height: '100%' }}>
                {/* Horizontal grid lines */}
                {Array.from({ length: 4 }).map((_, idx) => {
                  const y = elasticityPoints.padding + (idx / 3) * (elasticityPoints.height - elasticityPoints.padding * 2);
                  return <line key={idx} x1={elasticityPoints.padding} y1={y} x2={elasticityPoints.width - elasticityPoints.padding} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />;
                })}

                {/* Curve path */}
                <path
                  d={elasticityPoints.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                  fill="none"
                  stroke="var(--color-secondary)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dot markers */}
                {elasticityPoints.points.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="5"
                      fill="var(--color-secondary)"
                      stroke="var(--bg-main)"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      fill="var(--text-primary)"
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      ₹{pt.avg.toLocaleString()}
                    </text>
                    <text
                      x={pt.x}
                      y={elasticityPoints.height - 8}
                      fill="var(--text-muted)"
                      fontSize="9"
                      fontFamily="var(--font-sans)"
                      textAnchor="middle"
                    >
                      T+{pt.window}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

        </div>

        {/* Right Side: NSO / RBI API hub */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} className="trend-down" />
              RBI & NSO Registry Feed
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Select a system endpoint to query live JSON indexes, complete with compliance headers and rate credentials.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div 
                className={`api-route-selector ${apiRoute === '/api/index-history' ? 'active' : ''}`}
                style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  background: apiRoute === '/api/index-history' ? 'rgba(30, 58, 138, 0.08)' : '#f8fafc',
                  border: apiRoute === '/api/index-history' ? '1px solid var(--color-primary)' : '1px solid var(--border-light)',
                  cursor: 'pointer'
                }}
                onClick={() => { setApiRoute('/api/index-history'); setApiResponse(''); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Historical Inflation Indices</span>
                  <span className="badge badge-info">GET</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>/api/index-history</span>
              </div>

              <div 
                className={`api-route-selector ${apiRoute === '/api/raw-flights' ? 'active' : ''}`}
                style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  background: apiRoute === '/api/raw-flights' ? 'rgba(30, 58, 138, 0.08)' : '#f8fafc',
                  border: apiRoute === '/api/raw-flights' ? '1px solid var(--color-primary)' : '1px solid var(--border-light)',
                  cursor: 'pointer'
                }}
                onClick={() => { setApiRoute('/api/raw-flights'); setApiResponse(''); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>De-duplicated Raw Flight Log</span>
                  <span className="badge badge-info">GET</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>/api/raw-flights</span>
              </div>
            </div>
          </div>

          {/* cURL Display */}
          <div>
            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>cURL Request Command</span>
            <div className="api-block">
              <pre style={{ whiteSpace: 'pre-wrap' }}>{curlCommand}</pre>
            </div>
          </div>

          {/* Trigger Request button */}
          <div>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={handleTestCall}
              disabled={isCalling}
            >
              <Globe size={16} />
              {isCalling ? 'Querying REST Service...' : 'Execute Local Sandbox Query'}
            </button>

            {apiResponse && (
              <div style={{ marginTop: '1.25rem' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Response payload (JSON)</span>
                <div className="api-block" style={{ height: '200px', overflowY: 'auto' }}>
                  <pre style={{ margin: 0 }}>{apiResponse}</pre>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
