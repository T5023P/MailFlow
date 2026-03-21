import { useState, useEffect } from 'react';
import { AlertCircle, Trash2, Check, X } from 'lucide-react';
import { getAccounts, addAccount, toggleAccount, deleteAccount } from '../api';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ email: '', app_password: '', daily_cap: 40 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }

  const fetchAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await addAccount(form);
      setMessage({ type: 'success', text: `✓ SMTP verified — ${form.email} added successfully.` });
      setForm({ email: '', app_password: '', daily_cap: 40 });
      fetchAccounts();
    } catch (err) {
      setMessage({ type: 'error', text: `✗ ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, isActive) => {
    await toggleAccount(id, { is_active: !isActive });
    fetchAccounts();
  };

  const handleDelete = async (id) => {
    await deleteAccount(id);
    fetchAccounts();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Accounts</h2>

      {/* Warning banner if no accounts */}
      {accounts.length === 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg px-4 py-3 mb-6 animate-fade-in">
          <AlertCircle size={18} />
          <p className="text-sm">No accounts added yet. Add a Gmail account with an App Password to start sending.</p>
        </div>
      )}

      {/* Add Account Form */}
      <form onSubmit={handleAdd} className="glass-card p-5 mb-6">
        <h3 className="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">Add New Account</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-muted mb-1.5">Gmail Address</label>
            <input
              type="email"
              required
              placeholder="you@gmail.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-muted mb-1.5">App Password</label>
            <input
              type="password"
              required
              placeholder="xxxx xxxx xxxx xxxx"
              value={form.app_password}
              onChange={(e) => setForm({ ...form, app_password: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-muted mb-1.5">Daily Cap</label>
            <input
              type="number"
              min="1"
              value={form.daily_cap}
              onChange={(e) => setForm({ ...form, daily_cap: parseInt(e.target.value) || 40 })}
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 text-sm"
          >
            {loading ? 'Verifying…' : 'Add Account'}
          </button>
        </div>
        {message && (
          <p className={`mt-3 text-sm animate-fade-in ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {message.text}
          </p>
        )}
      </form>

      {/* Accounts Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-muted text-left">
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Daily Cap</th>
                <th className="px-5 py-3 font-medium">Sent Today</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">No accounts</td></tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="border-b border-[#1e1e1e] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{acc.email}</td>
                    <td className="px-5 py-3 text-muted">{acc.daily_cap}</td>
                    <td className="px-5 py-3 text-amber-400">{acc.sent_today}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleToggle(acc.id, acc.is_active)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          acc.is_active ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          acc.is_active ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDelete(acc.id)}
                        className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
