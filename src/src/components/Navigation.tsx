import React from 'react';
import { 
  TrendingUp, 
  Cpu, 
  Sliders, 
  ShieldAlert, 
  Database
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'executive', label: 'Executive Analytics', icon: <TrendingUp size={18} /> },
    { id: 'scraper', label: 'Crawler Center', icon: <Cpu size={18} /> },
    { id: 'policy', label: 'Policy Configurator', icon: <Sliders size={18} /> },
    { id: 'anomalies', label: 'Outlier Audit', icon: <ShieldAlert size={18} /> },
    { id: 'api', label: 'RBI/NSO Data Feed', icon: <Database size={18} /> },
  ];

  return (
    <nav className="sidebar">
      <div className="brand-section">
        <div className="brand-logo">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v20" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div className="brand-text">
          <h1>MoSPI RT-APIx</h1>
          <span>DIID Govt of India</span>
        </div>
      </div>

      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.id} className="nav-item">
            <button
              onClick={() => setActiveTab(item.id)}
              className={`nav-button ${activeTab === item.id ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="nav-footer">
        <div className="gov-seal">
          {/* Stylized vector representation of Ashoka Chakra / Indian Seal */}
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#b91c1c" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="3,3" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="1" fill="#b91c1c" />
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x2 = 12 + 6 * Math.cos(angle);
              const y2 = 12 + 6 * Math.sin(angle);
              return <line key={i} x1="12" y1="12" x2={x2} y2={y2} />;
            })}
          </svg>
        </div>
        <div className="nav-footer-text">
          <h4>NSO Statistics</h4>
          <p>CPI Augment (v1.2)</p>
        </div>
      </div>
    </nav>
  );
};
