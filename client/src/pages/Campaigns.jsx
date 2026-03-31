import { useState, useEffect } from 'react';
import { Play, Pause, Square, Plus, Loader2, Mail, CheckCircle2, X } from 'lucide-react';
import { getCampaigns, createCampaign, launchCampaign, pauseCampaign, stopCampaign, getTemplates, getLeads } from '../api';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', template_id: '' });
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      const [c, t, l] = await Promise.all([
        getCampaigns(),
        getTemplates(),
        getLeads(1, 2000)
      ]);
      setCampaigns(c || []);
      setTemplates(t || []);
      setLeads(l?.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.template_id || leads.length === 0) return;
    setCreating(true);
    try {
      await createCampaign({
        name: form.name,
        template_id: form.template_id,
        lead_ids: (leads || []).map(l => l.id),
      });
      setForm({ name: '', template_id: '' });
      setShowForm(false);
      fetchData();
    } catch (err) {
      console.error('Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      if (action === 'launch') await launchCampaign(id);
      if (action === 'pause') await pauseCampaign(id);
      if (action === 'stop') await stopCampaign(id);
      fetchData();
    } catch (err) {
      console.error('Action error:', err);
    }
  };

  return (
    <div className="animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Campaigns</h2>
          <p className="text-gray-500 text-sm mt-1">Manage and monitor your outreach performance</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Cancel' : 'New Campaign'}
        </button>
      </div>

      {/* New Campaign Form */}
      {showForm && (
        <div className="glass-card p-6 mb-8 border-amber-500/30 bg-amber-500/5 animate-slide-in">
          <h3 className="text-lg font-bold text-white mb-4">Create New Campaign</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Campaign Name</label>
              <input
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="e.g. Q1 Outreach"
                className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Template</label>
              <select
                required
                value={form.template_id}
                onChange={e => setForm({...form, template_id: e.target.value})}
                className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500 outline-none cursor-pointer appearance-none"
              >
                <option value="">Select a template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={creating || (leads || []).length === 0}
                className="w-full py-3 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-all shadow-lg"
              >
                {creating ? <Loader2 className="animate-spin mx-auto" /> : `Create with ${leads?.length || 0} Leads`}
              </button>
            </div>
          </form>
          {(leads || []).length === 0 && !loading && (
            <p className="mt-3 text-red-500 text-xs font-medium">Please add some leads first to create a campaign.</p>
          )}
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" size={32} /></div>
      ) : (
        <div className="grid gap-4">
          {(campaigns || []).length === 0 ? (
            <div className="glass-card p-12 text-center text-gray-500 bg-white/5 border-dashed border-gray-800">
              <Mail className="mx-auto mb-4 opacity-10" size={48} />
              <p>No campaigns yet. Click "New Campaign" to begin.</p>
            </div>
          ) : (
            campaigns.map(c => (
              <div key={c.id} className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02]">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xl font-bold text-white tracking-wide">{c.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      c.status === 'running' ? 'bg-green-500/10 text-green-500' :
                      c.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-[11px] text-gray-500 font-medium font-mono uppercase">
                    <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-gray-400" /> {c.total_leads} Leads</div>
                    <div>Sent: <span className="text-amber-500">{c.sent_count}</span></div>
                    <div>Template: <span className="text-gray-300">{c.templates?.name || '—'}</span></div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(c.status === 'draft' || c.status === 'paused') && (
                    <button
                      onClick={() => handleAction(c.id, 'launch')}
                      className="p-3 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                      title="Launch"
                    >
                      <Play size={18} />
                    </button>
                  )}
                  {c.status === 'running' && (
                    <button
                      onClick={() => handleAction(c.id, 'pause')}
                      className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                      title="Pause"
                    >
                      <Pause size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(c.id, 'stop')}
                    className="p-3 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                    title="Stop"
                  >
                    <Square size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
