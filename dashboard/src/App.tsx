import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Smartphone, 
  ShieldCheck, 
  Database,
  Search,
  RefreshCw,
  LogOut,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import './App.css';

// Types
interface Stats {
  users: number;
  orders: number;
  revenue: number;
}

interface User {
  id: string;
  phone: string;
  name: string;
  email: string;
  balance: number;
  role: string;
  status: string;
}

interface Rate {
  country_code: string;
  service_code: string;
  price: number;
  display_name: string;
}

interface BotStatus {
  status: string;
  isRegistered: boolean;
  phoneNumber: string | null;
  pairingCode: string | null;
}

const ADMIN_SECRET = localStorage.getItem('admin_secret') || '';

function App() {
  const [stats, setStats] = useState<Stats>({ users: 0, orders: 0, revenue: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>({ status: 'unknown', isRegistered: false, phoneNumber: null, pairingCode: null });
  const [upstreamBalances, setUpstreamBalances] = useState({ fivesim: '...', smsactivate: '...' });
  const [secret, setSecret] = useState(ADMIN_SECRET);
  const [isAuthenticated, setIsAuthenticated] = useState(!!ADMIN_SECRET);
  const [manualPhone, setManualPhone] = useState('');

  // Rate Form State
  const [newRate, setNewRate] = useState<Rate>({ country_code: '', service_code: '', price: 0, display_name: '' });

  const api = axios.create({
    headers: { 'x-admin-secret': secret }
  });

  const fetchData = async () => {
    if (!isAuthenticated) return;
    try {
      const [s, u, r, b, up] = await Promise.all([
        api.get('/api/stats'),
        api.get('/api/users'),
        api.get('/api/rates'),
        api.get('/api/bot/status'),
        api.get('/api/upstream/balance')
      ]);
      setStats(s.data);
      setUsers(u.data);
      setRates(r.data);
      setBotStatus(b.data);
      setUpstreamBalances(up.data);
    } catch (err) {
      console.error('Fetch Error:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s for linking status
    return () => clearInterval(interval);
  }, [isAuthenticated, secret]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('admin_secret', secret);
    setIsAuthenticated(true);
  };

  const handleFund = async (phone: string, amount: string) => {
    const amt = parseInt(amount);
    if (!amt) return;
    try {
      await api.post('/api/users/fund', { phone, amount: amt });
      fetchData();
    } catch (err) {
      alert('Funding failed');
    }
  };

  const handleRateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/rates', newRate);
      setNewRate({ country_code: '', service_code: '', price: 0, display_name: '' });
      fetchData();
    } catch (err) {
      alert('Failed to update rate');
    }
  };

  const handleRateDelete = async (country: string, service: string) => {
    if (!window.confirm(`Delete rate for ${country} ${service}?`)) return;
    try {
      await api.delete('/api/rates', { data: { country_code: country, service_code: service } });
      fetchData();
    } catch (err) {
      alert('Failed to delete rate');
    }
  };

  const requestPairing = async () => {
    const phone = manualPhone || botStatus.phoneNumber;
    if (!phone) {
      alert('Enter a phone number (e.g., 23480...)');
      return;
    }
    try {
      await api.post('/api/bot/pair', { phone });
      fetchData();
    } catch (err) {
      alert('Failed to get pairing code');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="card" style={{ width: '400px' }}>
          <h2>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="Admin Secret" 
              value={secret} 
              onChange={(e) => setSecret(e.target.value)} 
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <button className="btn" style={{ width: '100%' }}>Enter Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="sidebar">
        <h1 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>IOSB Admin</h1>
        <nav>
          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} /> Dashboard
          </div>
          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} /> Users
          </div>
          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Smartphone size={18} /> Bot Management
          </div>
          <div style={{ marginTop: '2rem' }}>
            <button className="btn btn-danger" onClick={() => { localStorage.removeItem('admin_secret'); setIsAuthenticated(false); }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </nav>
      </div>

      <div className="main-content">
        <div className="stats-grid">
          <div className="card stat-card">
            <h3><Users size={14} /> Total Users</h3>
            <p>{stats.users}</p>
          </div>
          <div className="card stat-card">
            <h3><ShoppingCart size={14} /> Total Orders</h3>
            <p>{stats.orders}</p>
          </div>
          <div className="card stat-card">
            <h3><DollarSign size={14} /> Total Revenue</h3>
            <p>₦{stats.revenue}</p>
          </div>
          <div className="card stat-card">
            <h3><RefreshCw size={14} /> Upstream Balances</h3>
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              5SIM: {upstreamBalances.fivesim} | SA: {upstreamBalances.smsactivate}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Bot Manager */}
          <div className="card">
            <h2>Bot Management</h2>
            <div style={{ marginBottom: '1rem' }}>
              Status: <span className={`status-badge status-${botStatus.status}`}>{botStatus.status.toUpperCase()}</span>
            </div>
            {botStatus.isRegistered ? (
              <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} /> Device Linked: *{botStatus.phoneNumber}*
              </div>
            ) : (
              <div>
                {!botStatus.pairingCode && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Enter phone number to link:</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        placeholder="234XXXXXXXXXX" 
                        value={manualPhone || (botStatus.phoneNumber || '')} 
                        onChange={e => setManualPhone(e.target.value)} 
                        style={{ flex: 1 }}
                      />
                      <button className="btn" onClick={requestPairing}>Get Code</button>
                    </div>
                  </div>
                )}
                
                {botStatus.pairingCode && (
                  <div style={{ background: 'var(--bg-dark)', padding: '1.5rem', textAlign: 'center', borderRadius: '12px', border: '2px solid var(--primary)' }}>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Enter this on your phone:</p>
                    <h1 style={{ margin: '1rem 0', letterSpacing: '6px', fontSize: '2.5rem', color: 'var(--primary)' }}>{botStatus.pairingCode}</h1>
                    <button className="btn btn-secondary" style={{ fontSize: '0.7rem' }} onClick={requestPairing}>Regenerate</button>
                  </div>
                )}
                
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  <AlertTriangle size={14} />
                  <span>Go to WhatsApp {"->"} Linked Devices {"->"} Link with phone number instead.</span>
                </div>
              </div>
            )}
          </div>

          {/* Rates Config */}
          <div className="card">
            <h2>Rate Management</h2>
            <form onSubmit={handleRateUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <input placeholder="USA" value={newRate.country_code} onChange={e => setNewRate({...newRate, country_code: e.target.value.toUpperCase()})} />
              <input placeholder="ws" value={newRate.service_code} onChange={e => setNewRate({...newRate, service_code: e.target.value.toLowerCase()})} />
              <input placeholder="USA WhatsApp" value={newRate.display_name} onChange={e => setNewRate({...newRate, display_name: e.target.value})} />
              <input type="number" placeholder="5000" value={newRate.price || ''} onChange={e => setNewRate({...newRate, price: parseInt(e.target.value)})} />
              <button className="btn" style={{ gridColumn: 'span 2' }}><Plus size={16} /> Update Rate</button>
            </form>
            <table style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Service</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.slice(0, 5).map(r => (
                  <tr key={r.country_code + r.service_code}>
                    <td>{r.country_code}</td>
                    <td>{r.display_name}</td>
                    <td>₦{r.price}</td>
                    <td>
                      <Trash2 size={14} style={{ cursor: 'pointer', color: 'var(--danger)' }} onClick={() => handleRateDelete(r.country_code, r.service_code)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Table */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>User Management</h2>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
              <input type="text" placeholder="Search phone..." style={{ paddingLeft: '2.5rem' }} />
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Name</th>
                <th>Balance</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.phone}</td>
                  <td>{u.name}</td>
                  <td>₦{u.balance}</td>
                  <td><span style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                  <td>
                    <button 
                      className="btn" 
                      onClick={() => {
                        const amt = prompt('Enter amount to fund:');
                        if (amt) handleFund(u.phone, amt);
                      }}
                    >
                      Fund
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
