import React, { useState } from 'react';
import type { Anomaly, Override } from '../types';
import { ShieldAlert, FileText, AlertTriangle } from 'lucide-react';

interface AnomalyHubProps {
  anomalies: Anomaly[];
  overrides: Override[];
  onApplyOverride: (flightId: string, action: 'exclude' | 'correct', price: number | null, notes: string) => Promise<void>;
}

export const AnomalyHub: React.FC<AnomalyHubProps> = ({ anomalies, overrides, onApplyOverride }) => {
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [overrideAction, setOverrideAction] = useState<'exclude' | 'correct'>('exclude');
  const [manualPrice, setManualPrice] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleOpenOverride = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setManualPrice(anomaly.total_fare.toString());
    setAuditNotes('');
    setOverrideAction('exclude');
  };

  const handleCloseOverride = () => {
    setSelectedAnomaly(null);
  };

  const handleSubmitOverride = async () => {
    if (!selectedAnomaly) return;
    if (!auditNotes.trim()) {
      alert("Please provide audit notes explaining the index correction rationale.");
      return;
    }

    setIsSubmitting(true);
    const priceVal = overrideAction === 'correct' ? parseInt(manualPrice) : null;
    await onApplyOverride(selectedAnomaly.id, overrideAction, priceVal, auditNotes);
    setIsSubmitting(false);
    setSelectedAnomaly(null);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Auditing & Anomaly Override Hub</h2>
        <p>Audit price quotes flagged by statistical Z-score controls, override faulty fares, and maintain compliance record trails.</p>
      </div>

      <div className="main-dashboard-grid">
        {/* Flagged Anomalies List */}
        <div className="card-panel">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} className="trend-up" />
            Flagged Outlier Records
          </h3>

          {anomalies.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No current price anomalies flagged in the current data basket.
            </div>
          ) : (
            <div className="anomaly-grid">
              {anomalies.map((anom) => {
                const hasBeenOverridden = overrides.some(o => o.flight_id === anom.id);
                return (
                  <div key={anom.id} className="anomaly-item" style={{ opacity: hasBeenOverridden ? 0.6 : 1 }}>
                    <div className="anomaly-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="anomaly-title">{anom.carrier} - {anom.flight_number}</span>
                        <span className="badge badge-danger">Z-Score: +{anom.z_score}</span>
                        {hasBeenOverridden && <span className="badge badge-success">Audited</span>}
                      </div>
                      <span className="anomaly-meta">
                        Sector: <strong>{anom.origin} &rarr; {anom.destination}</strong> | Departure: {anom.departure_date} (T+{anom.days_ahead} days)
                      </span>
                      <span className="anomaly-meta">
                        Fare Details: Base: ₹{anom.base_fare.toLocaleString()} | Taxes & fees: ₹{(anom.taxes + anom.udf + anom.convenience_fee).toLocaleString()} | Total: <strong>₹{anom.total_fare.toLocaleString()}</strong>
                      </span>
                      <span className="anomaly-desc">
                        <AlertTriangle size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        {anom.reason}
                      </span>
                    </div>

                    <div>
                      {!hasBeenOverridden && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                          onClick={() => handleOpenOverride(anom)}
                        >
                          Audit Price
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit Trails Timeline Ledger */}
        <div className="card-panel">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} className="trend-down" />
            Audit Override Trails
          </h3>

          {overrides.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No audit override logs written to registry.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {overrides.map((ov, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    background: '#f8fafc', 
                    border: '1px solid var(--border-light)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span style={{ color: ov.action === 'exclude' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {ov.action === 'exclude' ? 'Excluded Fare from Basket' : `Price Adjusted to ₹${ov.manual_price?.toLocaleString()}`}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(ov.timestamp).toLocaleDateString('en-IN')} {new Date(ov.timestamp).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>Flight ID: {ov.flight_id.split('_').slice(0, 3).join(' ')}</span>
                  <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>Reason: "{ov.notes}"</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Authorized by: {ov.operator}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Form Modal */}
      {selectedAnomaly && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Audit Index Flight Quote</h3>
            
            <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <p>Flight: <strong>{selectedAnomaly.carrier} {selectedAnomaly.flight_number}</strong></p>
              <p>Route: {selectedAnomaly.origin} &rarr; {selectedAnomaly.destination} | Date: {selectedAnomaly.departure_date}</p>
              <p>Current Total Price: <strong style={{ color: 'var(--color-danger)' }}>₹{selectedAnomaly.total_fare.toLocaleString()}</strong></p>
            </div>

            <div className="form-group">
              <label>Override Choice</label>
              <select 
                className="select-input"
                value={overrideAction}
                onChange={(e) => setOverrideAction(e.target.value as 'exclude' | 'correct')}
              >
                <option value="exclude">Exclude completely from calculation basket</option>
                <option value="correct">Override with standard historical pricing estimate</option>
              </select>
            </div>

            {overrideAction === 'correct' && (
              <div className="form-group">
                <label>Manual Price (INR)</label>
                <input 
                  type="number" 
                  className="text-input" 
                  value={manualPrice} 
                  onChange={(e) => setManualPrice(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Compliance Audit Rationale Notes</label>
              <textarea 
                className="textarea-input"
                rows={3}
                placeholder="Describe why this price is being overridden (e.g. Airport closed due to fog, cyclone pricing cap trigger)..."
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={handleCloseOverride} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleSubmitOverride} disabled={isSubmitting}>
                {isSubmitting ? 'Applying Change...' : 'Authorize Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
