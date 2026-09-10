import React, { useState, useEffect } from 'react';
import { Sliders, Save, Info } from 'lucide-react';

interface PolicyConfiguratorProps {
  routeWeights: Record<string, number>;
  windowWeights: Record<number, number>;
  formula: 'laspeyres' | 'jevons';
  onUpdateSettings: (routes: Record<string, number>, windows: Record<number, number>, formula: 'laspeyres' | 'jevons') => void;
  onSaveToServer: () => Promise<void>;
}

export const PolicyConfigurator: React.FC<PolicyConfiguratorProps> = ({
  routeWeights,
  windowWeights,
  formula,
  onUpdateSettings,
  onSaveToServer
}) => {
  const [localRoutes, setLocalRoutes] = useState<Record<string, number>>({ ...routeWeights });
  const [localWindows, setLocalWindows] = useState<Record<number, number>>({ ...windowWeights });
  const [localFormula, setLocalFormula] = useState<'laspeyres' | 'jevons'>(formula);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync state if props change
  useEffect(() => {
    setLocalRoutes({ ...routeWeights });
  }, [routeWeights]);

  useEffect(() => {
    setLocalWindows({ ...windowWeights });
  }, [windowWeights]);

  useEffect(() => {
    setLocalFormula(formula);
  }, [formula]);

  // Compute normalized sums for visualization
  const routeSum = Object.values(localRoutes).reduce((a, b) => a + b, 0);
  const windowSum = Object.values(localWindows).reduce((a, b) => a + b, 0);

  const getNormalizedRoutePercent = (key: string) => {
    if (routeSum === 0) return 0;
    return Math.round((localRoutes[key] / routeSum) * 100);
  };

  const getNormalizedWindowPercent = (key: number) => {
    if (windowSum === 0) return 0;
    return Math.round((localWindows[key] / windowSum) * 100);
  };

  const handleRouteSlider = (key: string, val: number) => {
    const updated = { ...localRoutes, [key]: val };
    setLocalRoutes(updated);
    onUpdateSettings(updated, localWindows, localFormula);
  };

  const handleWindowSlider = (key: number, val: number) => {
    const updated = { ...localWindows, [key]: val };
    setLocalWindows(updated);
    onUpdateSettings(localRoutes, updated, localFormula);
  };

  const handleFormulaChange = (newForm: 'laspeyres' | 'jevons') => {
    setLocalFormula(newForm);
    onUpdateSettings(localRoutes, localWindows, newForm);
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    await onSaveToServer();
    setIsSaving(false);
  };

  const routeLabelNames: Record<string, string> = {
    "DEL-BOM": "DEL-BOM (Delhi-Mumbai)",
    "DEL-BLR": "DEL-BLR (Delhi-Bengaluru)",
    "BOM-BLR": "BOM-BLR (Mumbai-Bengaluru)",
    "DEL-CCU": "DEL-CCU (Delhi-Kolkata)",
    "BLR-HYD": "BLR-HYD (Bengaluru-Hyderabad)",
    "MAA-DEL": "MAA-DEL (Chennai-Delhi)"
  };

  return (
    <div>
      <div className="page-header">
        <h2>Index Policy Configurator</h2>
        <p>Fine-tune Consumer Price Index (CPI) weight structures based on DGCA traffic data and select index formulation standards.</p>
      </div>

      <div className="main-dashboard-grid">
        {/* Left Side: Sliders Config */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Sector Weights Section */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={18} className="trend-down" />
              Sectoral Weight Controls
            </h3>
            
            {/* Weight distribution bar */}
            <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '1.5rem', background: '#e2e8f0' }}>
              {Object.keys(localRoutes).map((key, idx) => {
                const pct = getNormalizedRoutePercent(key);
                const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
                if (pct === 0) return null;
                return (
                  <div 
                    key={key} 
                    style={{ width: `${pct}%`, background: colors[idx % colors.length], height: '100%' }} 
                    title={`${key}: ${pct}%`}
                  />
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.keys(localRoutes).map((key) => (
                <div key={key} className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 500 }}>{routeLabelNames[key] || key}</span>
                    <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                      Share: {getNormalizedRoutePercent(key)}% ({localRoutes[key]})
                    </span>
                  </div>
                  <div className="slider-container">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={localRoutes[key]} 
                      className="range-slider" 
                      onChange={(e) => handleRouteSlider(key, parseInt(e.target.value))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Booking Windows weights */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Booking Window Weights
            </h3>

            {/* Window distribution bar */}
            <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '1.5rem', background: '#e2e8f0' }}>
              {Object.keys(localWindows).map((keyStr, idx) => {
                const key = parseInt(keyStr);
                const pct = getNormalizedWindowPercent(key);
                const colors = ['#818cf8', '#22d3ee', '#34d399', '#fbbf24', '#f87171'];
                if (pct === 0) return null;
                return (
                  <div 
                    key={key} 
                    style={{ width: `${pct}%`, background: colors[idx % colors.length], height: '100%' }} 
                    title={`T+${key}: ${pct}%`}
                  />
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.keys(localWindows).map((keyStr) => {
                const key = parseInt(keyStr);
                return (
                  <div key={key} className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 500 }}>T+{key} Days Booking Window</span>
                      <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                        Share: {getNormalizedWindowPercent(key)}% ({localWindows[key]})
                      </span>
                    </div>
                    <div className="slider-container">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={localWindows[key]} 
                        className="range-slider" 
                        onChange={(e) => handleWindowSlider(key, parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%' }} 
            onClick={handleSaveClick}
            disabled={isSaving}
          >
            <Save size={16} />
            {isSaving ? 'Synchronizing Archive...' : 'Commit & Lock Weights to DB'}
          </button>
        </div>

        {/* Right Side: Formula / Equations Policy details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Index standard configuration */}
          <div className="card-panel">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Index Formula Standard</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => handleFormulaChange('laspeyres')}
                className={`btn ${localFormula === 'laspeyres' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem' }}
              >
                Laspeyres
              </button>
              <button 
                onClick={() => handleFormulaChange('jevons')}
                className={`btn ${localFormula === 'jevons' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem' }}
              >
                Jevons
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--color-secondary)' }}>
                {localFormula === 'laspeyres' ? 'Laspeyres Price Index (MoSPI Base)' : 'Jevons Price Index (Geometric Mean)'}
              </span>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {localFormula === 'laspeyres' 
                  ? 'A weighted arithmetic index formulation. Tracks average price variations by holding commodity quantities (represented here as passenger routing volumes) fixed in the base period. The standard model for верх level CPI aggregations in India.'
                  : 'An unweighted geometric mean index formulation. Calculates price changes by computing the geometric average of price relatives, making it highly robust against outliers and substitution biases. Commonly used for lower-level category aggregates.'
                }
              </p>
            </div>
          </div>

          {/* Mathematical formulation visualization card */}
          <div className="card-panel">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={16} className="trend-down" />
              Statistical Specification
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>Mathematical Formula</span>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  {localFormula === 'laspeyres' 
                    ? 'I_L = [ ∑ ( P_it / P_i0 ) * W_i ] / ∑ W_i * 100'
                    : 'I_J = ∏ [ P_it / P_i0 ]^(1/n) * 100'
                  }
                </div>
              </div>

              <div>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.25rem' }}>Definition of Terms</span>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li><strong>P_it</strong>: Jevons mean price of flight sector <i>i</i> on current day <i>t</i></li>
                  <li><strong>P_i0</strong>: Jevons mean price of flight sector <i>i</i> on base date T_0</li>
                  <li><strong>W_i</strong>: Cumulative joint weight of Route share * booking window share</li>
                  <li><strong>n</strong>: Total number of active route-window cohorts</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
