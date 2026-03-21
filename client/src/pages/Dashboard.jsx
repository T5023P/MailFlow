import { useState, useEffect, useRef } from 'react';
import { Send, Clock, AlertTriangle, UserCheck, Play, Pause, Square } from 'lucide-react';
import { getStats, getCampaigns, launchCampaign, pauseCampaign, stopCampaign } from '../api';

const statCards = [
  { key: 'totalSent', label: 'Total Sent', icon: Send, color: 'text-amber-500' },
  { key: 'totalPending', label: 'Total Pending', icon: Clock, color: 'text-yellow-500' },
  { key: 'totalFailed', label: 'Total Failed', icon: AlertTriangle, color: 'text-red-500' },
  { key: 'activeAccounts', label: 'Active Accounts', icon: UserCheck, color: 'text-green-500' },
];

function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-gray-500/20 text-gray-400',
    running: 'bg-amber-500/20 text-amber-400 animate-pulse-amber',
    paused: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-green-500/20 text-green-400',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ totalSent: 0, totalPending: 0, totalFailed: 0, activeAccounts: 0 });
  const [campaigns, setCampaigns] = useState([]);
  const intervalRef = useRef(null);

  const fetchData = async () => {
    try {
      const [s, c] = await Promise.all([getStats(), getCampaigns()]);
      setStats(s);
      setCampaigns(c);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleLaunch = async (id) => { await launchCampaign(id); fetchData(); };
  const handlePause = async (id) => { await pauseCampaign(id); fetchData(); };
  const handleStop = async (id) => { await stopCampaign(id); fetchData(); };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* ── Stat Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="glass-card p-5 relative overflow-hidden group hover:border-amber-500/30">
            <Icon size={20} className={`absolute top-4 right-4 ${color} opacity-60 group-hover:opacity-100 transition-opacity`} />
            <p className={`text-3xl font-bold ${color}`}>{stats[key]}</p>
            <p className="text-sm text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Campaigns Table ─────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e1e1e]">
          <h3 className="text-lg font-semibold">All Campaigns</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-muted text-left">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Sent</th>
                <th className="px-5 py-3 font-medium">Failed</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No campaigns yet</td></tr>
              ) : (
                campaigns.map((c) => {
                  const pct = c.total_leads > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_leads) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-b border-[#1e1e1e] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-medium text-white">{c.name}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-5 py-3 w-40">
                        <div className="progress-bar">
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted mt-1">{pct}%</p>
                      </td>
                      <td className="px-5 py-3 text-green-400">{c.sent_count}</td>
                      <td className="px-5 py-3 text-red-400">{c.failed_count}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {(c.status === 'draft' || c.status === 'paused') && (
                            <button onClick={() => handleLaunch(c.id)} className="p-1.5 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" title="Launch">
                              <Play size={14} />
                            </button>
                          )}
                          {c.status === 'running' && (
                            <button onClick={() => handlePause(c.id)} className="p-1.5 rounded-md bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" title="Pause">
                              <Pause size={14} />
                            </button>
                          )}
                          {(c.status === 'running' || c.status === 'paused') && (
                            <button onClick={() => handleStop(c.id)} className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30" title="Stop">
                              <Square size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
