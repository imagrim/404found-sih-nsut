import React, { useState, useEffect, useRef } from 'react';
import type { ScraperStatus } from '../types';
import { Play, Cpu, RefreshCw, Layers, ShieldCheck, Shuffle, Download, Database, AlertTriangle, ArrowRight } from 'lucide-react';

interface ScraperDashboardProps {
  onRefreshAllData: () => void;
}

interface ScrapedTicket {
  flightNo: string;
  carrier: string;
  baseFare: number;
  taxes: number;
  totalFare: number;
  isAnomaly: boolean;
}

export const ScraperDashboard: React.FC<ScraperDashboardProps> = ({ onRefreshAllData }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [scrapers, setScrapers] = useState<ScraperStatus[]>([
    { name: 'IndiGo Crawler', status: 'idle', proxy: '103.85.114.102:8080', successRate: 98.4, currentRoute: 'N/A', currentWindow: 0 },
    { name: 'Air India Crawler', status: 'idle', proxy: '43.224.10.89:80', successRate: 97.2, currentRoute: 'N/A', currentWindow: 0 },
    { name: 'SpiceJet Crawler', status: 'idle', proxy: '150.129.148.115:3128', successRate: 94.6, currentRoute: 'N/A', currentWindow: 0 },
    { name: 'Akasa Air Crawler', status: 'idle', proxy: '103.85.114.102:8080', successRate: 99.1, currentRoute: 'N/A', currentWindow: 0 }
  ]);

  // High graphic state variables
  const [currentStep, setCurrentStep] = useState<number>(0); // 0=idle, 1=compliance, 2=proxies, 3=scraping, 4=parsing, 5=database
  const [scrapedTickets, setScrapedTickets] = useState<ScrapedTicket[]>([]);
  const [activeProxy, setActiveProxy] = useState<string>('N/A');
  const [activeRoute, setActiveRoute] = useState<string>('N/A');
  const [isSandboxFallback, setIsSandboxFallback] = useState<boolean>(false);
  const [latency, setLatency] = useState<number>(0);
  
  const ticketsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ticketsEndRef.current) {
      ticketsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrapedTickets]);

  const triggerScraper = () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsFinished(false);
    setScrapedTickets([]);
    setCurrentStep(1);
    setIsSandboxFallback(false);
    setLatency(0);
    setActiveProxy('N/A');
    setActiveRoute('DEL-BOM');

    // Set scrapers to crawling
    setScrapers(prev => prev.map(s => ({ ...s, status: 'crawling', currentRoute: 'DEL-BOM', currentWindow: 15 })));

    let isCleanClose = false;
    const eventSource = new EventSource('http://localhost:3001/api/stream-scraper-logs');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const text = data.message;

      // Parse current status steps from python output
      if (text.includes('robots.txt')) {
        setCurrentStep(1); // Ethical checks
      } else if (text.includes('PROXY_ROTATION') || text.includes('Switched to proxy')) {
        setCurrentStep(2); // Proxy rotation
        const proxyMatch = text.match(/proxy\s+([0-9\.\:]+)/);
        if (proxyMatch) setActiveProxy(proxyMatch[1]);
      } else if (text.includes('HTTP_REQUEST')) {
        setCurrentStep(3); // Fetching OTA
        const routeMatch = text.match(/srch=([A-Z\-]+)/);
        if (routeMatch) {
          const r = routeMatch[1];
          setActiveRoute(r);
          // Set individual active routes in listing
          setScrapers(prev => prev.map(s => ({ ...s, currentRoute: r })));
        }
      } else if (text.includes('CRAWLER_PARSING') || text.includes('PARSER_ELEMENT')) {
        setCurrentStep(4); // Parsing html cards
      } else if (text.includes('SANDBOX_FALLBACK')) {
        setIsSandboxFallback(true);
      } else if (text.includes('HTTP_SUCCESS')) {
        const msMatch = text.match(/in\s+(\d+)ms/);
        if (msMatch) setLatency(parseInt(msMatch[1]));
      }

      // Regex parser to extract scraped flights and add boarding passes
      if (text.includes('PARSER_ELEMENT') || text.includes('Extracted')) {
        // Sample: Extracted IN-650 | Base: Rs.4,013 | Tax: Rs.600 | Total: Rs.5,413
        const ticketRegex = /Extracted\s+([A-Za-z0-9\-]+)\s*\|\s*Base:\s*Rs\.([0-9,]+)\s*\|\s*Tax:\s*Rs\.([0-9,]+)\s*\|\s*Total:\s*Rs\.([0-9,]+)/i;
        const match = text.match(ticketRegex);
        
        if (match) {
          const flightNo = match[1];
          const baseFare = parseInt(match[2].replace(/,/g, ''));
          const taxes = parseInt(match[3].replace(/,/g, ''));
          const totalFare = parseInt(match[4].replace(/,/g, ''));
          
          let carrier = 'Other';
          if (flightNo.startsWith('IN') || flightNo.startsWith('6E')) carrier = 'IndiGo';
          else if (flightNo.startsWith('AI')) carrier = 'Air India';
          else if (flightNo.startsWith('SG')) carrier = 'SpiceJet';
          else if (flightNo.startsWith('QP')) carrier = 'Akasa Air';
          
          // Anomaly checks
          const isAnomaly = totalFare > 30000; // Simulated threshold flag
          
          setScrapedTickets(prev => [...prev, {
            flightNo,
            carrier,
            baseFare,
            taxes,
            totalFare,
            isAnomaly
          }]);
        }
      }

      if (data.type === 'pipeline') {
        setCurrentStep(5); // SQLite calculation pipeline
      }

      if (data.type === 'done') {
        isCleanClose = true;
        eventSource.close();
        setIsRunning(false);
        setIsFinished(true);
        setCurrentStep(5); // Keep completed step status
        setScrapers(prev => prev.map(s => ({ ...s, status: 'success', currentRoute: 'N/A', currentWindow: 0 })));
        onRefreshAllData();
      }
    };

    eventSource.onerror = (err) => {
      if (isCleanClose) return;
      console.error(err);
      eventSource.close();
      setIsRunning(false);
      setIsFinished(false);
      setCurrentStep(0);
      setScrapers(prev => prev.map(s => ({ ...s, status: 'error' })));
    };
  };

  return (
    <div>
      <div className="page-header">
        <h2>Crawler & Scraper Hub</h2>
        <p>Orchestrate live web scraping pipelines and monitor dynamic price acquisitions visually.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem', alignItems: 'stretch' }}>
        
        {/* Left Column: Settings and Mini Crawler Statuses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Controls Panel */}
          <div className="card-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={16} style={{ color: 'var(--color-secondary)' }} />
              Orchestrator Control
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Scrape Engine Mode</span>
                <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></span>
                  STEALTH CRAWL
                </span>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.65rem' }}
                onClick={triggerScraper}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'console-pulse 1s infinite' }} />
                    Running Scrape Grid...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Run Scrape Session
                  </>
                )}
              </button>
              {isFinished && (
                <div style={{ 
                  marginTop: '0.5rem', 
                  padding: '0.75rem', 
                  background: 'rgba(16, 185, 129, 0.08)', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  borderRadius: '6px', 
                  color: 'var(--color-success)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  fontSize: '0.75rem',
                  animation: 'slide-up 0.3s ease-out'
                }}>
                  <ShieldCheck size={16} />
                  <span>Crawl finished. CPI recalculations succeeded!</span>
                </div>
              )}
            </div>
          </div>

          {/* Simple Crawler Active Listing */}
          <div className="card-panel" style={{ flexGrow: 1, padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={16} style={{ color: 'var(--color-success)' }} />
              Scraper Agents
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {scrapers.map((s, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.65rem 0.85rem', 
                    borderRadius: '8px', 
                    background: '#f8fafc', 
                    border: '1px solid var(--border-light)' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: 
                          s.status === 'success' || s.status === 'idle' ? 'var(--color-success)' :
                          s.status === 'crawling' ? 'var(--color-primary)' :
                          s.status === 'parsing' ? 'var(--color-secondary)' :
                          'var(--color-danger)',
                        boxShadow: s.status === 'crawling' || s.status === 'parsing' ? '0 0 6px currentColor' : 'none'
                      }} 
                    />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {s.status === 'idle' ? 'Ready' : `Scanning T+${s.currentWindow}`}
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${
                    s.status === 'success' || s.status === 'idle' ? 'badge-success' : 
                    s.status === 'crawling' ? 'badge-primary' : 
                    s.status === 'parsing' ? 'badge-info' : 
                    'badge-danger'
                  }`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: High Graphic Visualizer Hub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Stepper progress indicator */}
          <div className="card-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Stealth Pipeline Tracker</h3>
              {isSandboxFallback && (
                <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', animation: 'console-pulse 1.5s infinite' }}>
                  <AlertTriangle size={10} />
                  FALLBACK SAFE MODE ACTIVE
                </span>
              )}
            </div>

            {/* Graphic Stepper */}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '0 0.5rem' }}>
              {/* Timeline Connector Line */}
              <div style={{ 
                position: 'absolute', 
                top: '16px', 
                left: '5%', 
                right: '5%', 
                height: '2px', 
                background: 'rgba(255,255,255,0.05)', 
                zIndex: 1 
              }} />
              <div style={{ 
                position: 'absolute', 
                top: '16px', 
                left: '5%', 
                width: `${currentStep === 0 ? 0 : (currentStep - 1) * 22.5}%`, 
                height: '2px', 
                background: 'var(--color-primary)', 
                transition: 'width 0.4s ease',
                zIndex: 1 
              }} />

              {/* Step 1: Robots check */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, width: '18%' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: currentStep >= 1 ? 'var(--color-primary)' : 'var(--bg-card)',
                  border: '2px solid ' + (currentStep >= 1 ? 'transparent' : 'var(--border-light)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                  <ShieldCheck size={14} />
                </div>
                <span style={{ fontSize: '0.65rem', textAlign: 'center', color: currentStep >= 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Compliance Check</span>
              </div>

              {/* Step 2: Proxy swap */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, width: '18%' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: currentStep >= 2 ? 'var(--color-primary)' : 'var(--bg-card)',
                  border: '2px solid ' + (currentStep >= 2 ? 'transparent' : 'var(--border-light)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                  <Shuffle size={14} />
                </div>
                <span style={{ fontSize: '0.65rem', textAlign: 'center', color: currentStep >= 2 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Proxy Swap</span>
              </div>

              {/* Step 3: Crawling */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, width: '18%' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: currentStep >= 3 ? 'var(--color-primary)' : 'var(--bg-card)',
                  border: '2px solid ' + (currentStep >= 3 ? 'transparent' : 'var(--border-light)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                  <Download size={14} />
                </div>
                <span style={{ fontSize: '0.65rem', textAlign: 'center', color: currentStep >= 3 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>GET Airfares</span>
              </div>

              {/* Step 4: Parse HTML */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, width: '18%' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: currentStep >= 4 ? 'var(--color-primary)' : 'var(--bg-card)',
                  border: '2px solid ' + (currentStep >= 4 ? 'transparent' : 'var(--border-light)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                  <Layers size={14} />
                </div>
                <span style={{ fontSize: '0.65rem', textAlign: 'center', color: currentStep >= 4 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Extract Elements</span>
              </div>

              {/* Step 5: SQL calculations */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, width: '18%' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: currentStep >= 5 ? 'var(--color-primary)' : 'var(--bg-card)',
                  border: '2px solid ' + (currentStep >= 5 ? 'transparent' : 'var(--border-light)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                  <Database size={14} />
                </div>
                <span style={{ fontSize: '0.65rem', textAlign: 'center', color: currentStep >= 5 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Relational Commit</span>
              </div>

            </div>

            {/* Active Details strip */}
            <div style={{ 
              marginTop: '1.25rem', 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr', 
              gap: '1rem', 
              background: '#f8fafc', 
              padding: '0.75rem 1rem', 
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              fontSize: '0.75rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Evasion Proxy</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{activeProxy}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Active Route Target</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeRoute}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>OTA Response Delay</span>
                <span style={{ fontWeight: 600, color: latency > 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                  {latency > 0 ? `${latency} ms` : 'Polling...'}
                </span>
              </div>
            </div>
          </div>

          {/* Scraped Boarding Passes Ticker */}
          <div className="card-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem', height: '320px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Live Fare Stream</h3>

            <div style={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.85rem', 
              maxHeight: '220px', 
              paddingRight: '0.25rem' 
            }}>
              {scrapedTickets.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Layers size={24} style={{ opacity: 0.15 }} />
                  <span style={{ fontSize: '0.75rem' }}>No ticket rows loaded. Run orchestrator to trigger.</span>
                </div>
              ) : (
                scrapedTickets.map((ticket, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      background: ticket.isAnomaly ? '#fff5f5' : '#f8fafc',
                      border: '1px solid ' + (ticket.isAnomaly ? 'rgba(153, 27, 27, 0.25)' : 'var(--border-light)'),
                      borderRadius: '8px', 
                      padding: '0.75rem 1rem', 
                      justifyContent: 'space-between',
                      animation: 'slide-up 0.25s ease-out'
                    }}
                  >
                    {/* Left: Carrier and Flight Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', fontFamily: 'var(--font-mono)' }}>
                        {ticket.flightNo}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{ticket.carrier}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>DEL</span>
                          <ArrowRight size={10} />
                          <span>BOM</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Details Breakdowns */}
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.15rem', textAlign: 'right' }}>
                      <div>Base Fare: Rs. {ticket.baseFare.toLocaleString('en-IN')}</div>
                      <div>Taxes: Rs. {ticket.taxes.toLocaleString('en-IN')}</div>
                    </div>

                    {/* Right: Price badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      <span style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 800, 
                        color: ticket.isAnomaly ? 'var(--color-danger)' : 'var(--color-success)' 
                      }}>
                        Rs. {ticket.totalFare.toLocaleString('en-IN')}
                      </span>
                      {ticket.isAnomaly && (
                        <span className="badge badge-danger" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem' }}>
                          OUTLIER ISOLATED
                        </span>
                      )}
                    </div>

                  </div>
                ))
              )}
              <div ref={ticketsEndRef} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
