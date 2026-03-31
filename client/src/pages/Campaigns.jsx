import { useState, useEffect } from 'react';
import {
  Play, Pause, Square, ChevronDown, ChevronUp, Search, X,
  MailCheck, Timer, ToggleLeft, ToggleRight, Globe, RefreshCw,
} from 'lucide-react';
import {
  getCampaigns, createCampaign, launchCampaign, pauseCampaign, stopCampaign,
  getCampaignLeads, getTemplates, getLeads, markLeadReplied, getLeadFilters,
} from '../api';

function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-gray-500/20 text-gray-400',
    running: 'bg-amber-500/20 text-amber-400 animate-pulse-amber',
    paused: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-green-500/20 text-green-400',
    pending: 'bg-gray-500/20 text-gray-400',
    sent: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    replied: 'bg-blue-500/20 text-blue-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedLeads, setExpandedLeads] = useState([]);

  // Filters for Lead Selector
  const [niches, setNiches] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [filtersLoading, setFiltersLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    template_id: '',
    delay_min: 30,
    delay_max: 90,
    // Follow-up settings
    followup_enabled: false,
    followup1_delay_days: 3,
    followup1_template_id: '',
    followup2_delay_days: 7,
    followup2_template_id: '',
    // Auto-scrape settings
    auto_scrape_enabled: false,
    auto_scrape_query: '',
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [leadFilter, setLeadFilter] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAll = async () => {
    try {
      // Increase limit to 2000 to ensure "all" leads are available for selection
      const [c, t, l] = await Promise.all([
        getCampaigns(),
        getTemplates(),
        getLeads(1, 2000, selectedNiche, selectedDate)
      ]);
      setCampaigns(c);
      setTemplates(t);
      setAllLeads(l.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFilters = async () => {
    setFiltersLoading(true);
    try {
      const { niches, dates } = await getLeadFilters();
      setNiches(niches);
      setDates(dates);
    } catch (e) {
      console.error(e);
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => { 
    fetchFilters(); 
    fetchAll(); 
  }, []);

  useEffect(() => {
    fetchAll();
  }, [selectedNiche, selectedDate]);

  const handleCreate = async () => {
    if (!form.name || !form.template_id || selectedLeadIds.length === 0) return;
    setCreating(true);
    try {
      await createCampaign({
        name: form.name,
        template_id: form.template_id,
        lead_ids: selectedLeadIds,
        delay_min: form.delay_min,
        delay_max: form.delay_max,
        followup_enabled: form.followup_enabled,
        followup1_delay_days: form.followup1_delay_days,
        followup1_template_id: form.followup1_template_id || null,
        followup2_delay_days: form.followup2_delay_days,
        followup2_template_id: form.followup2_template_id || null,
        auto_scrape_enabled: form.auto_scrape_enabled,
        auto_scrape_query: form.auto_scrape_query || null,
      });
      setForm({
        name: '', template_id: '', delay_min: 30, delay_max: 90,
        followup_enabled: false, followup1_delay_days: 3, followup1_template_id: '',
        followup2_delay_days: 7, followup2_template_id: '',
        auto_scrape_enabled: false, auto_scrape_query: '',
      });
      setSelectedLeadIds([]);
      fetchAll();
    } catch (err) {
      console.error(err);
    }
    setCreating(false);
  };

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    try {
      const data = await getCampaignLeads(id);
      setExpandedLeads(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLaunch = async (id) => { await launchCampaign(id); fetchAll(); };
  const handlePause = async (id) => { await pauseCampaign(id); fetchAll(); };
  const handleStop = async (id) => { await stopCampaign(id); fetchAll(); };

  const handleMarkReplied = async (campaignId, leadId) => {
    try {
      await markLeadReplied(campaignId, leadId);
      // Refresh expanded leads
      const data = await getCampaignLeads(campaignId);
      setExpandedLeads(data);
    } catch (e) {
      console.error(e);
    }
  };

  const availableLeads = allLeads.filter(
    (l) =>
      !selectedLeadIds.includes(l.id) &&
      (l.name?.toLowerCase().includes(leadFilter.toLowerCase()) ||
        l.email?.toLowerCase().includes(leadFilter.toLowerCase()))
  );
  const selectedLeads = allLeads.filter((l) => selectedLeadIds.includes(l.id));

  const addLead = (id) => setSelectedLeadIds([...selectedLeadIds, id]);
  const removeLead = (id) => setSelectedLeadIds(selectedLeadIds.filter((x) => x !== id));

  const selectAllFiltered = () => {
    const filteredIds = availableLeads.map(l => l.id);
    setSelectedLeadIds([...new Set([...selectedLeadIds, ...filteredIds])]);
  };

  const removeAllSelected = () => {
    setSelectedLeadIds([]);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Campaigns</h2>

      {/* ── New Campaign Form ───────────────────────────── */}
      <div className="glass-card p-5 mb-8">
        <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">New Campaign</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Campaign Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Q1 Outreach"
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Template</label>
            <select
              value={form.template_id}
              onChange={(e) => setForm({ ...form, template_id: e.target.value })}
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lead selector */}
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">Select Leads</label>
          <div className="flex gap-4">
            <select
              value={selectedNiche}
              onChange={(e) => setSelectedNiche(e.target.value)}
              className="bg-[#0a0a0a] border border-[#1e1e1e] text-gray-400 text-[11px] rounded px-2 py-1 outline-none focus:border-amber-500/50 min-w-[120px]"
            >
              <option value="">All Niches</option>
              {niches.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#0a0a0a] border border-[#1e1e1e] text-gray-400 text-[11px] rounded px-2 py-1 outline-none focus:border-amber-500/50 min-w-[100px]"
            >
              <option value="">All Dates</option>
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* Available */}
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-[#1e1e1e] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Search size={13} className="text-gray-500" />
                <input
                  value={leadFilter}
                  onChange={(e) => setLeadFilter(e.target.value)}
                  placeholder="Search available..."
                  className="bg-transparent text-xs text-white placeholder-gray-600 outline-none flex-1"
                />
              </div>
              {availableLeads.length > 0 && (
                <button 
                  onClick={selectAllFiltered}
                  className="text-[10px] bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-tight transition-colors"
                >
                  Select All ({availableLeads.length})
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto">
              {availableLeads.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-500 text-center">No leads found in this view</p>
              ) : (
                availableLeads.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => addLead(l.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-amber-500/10 hover:text-amber-400 transition-colors flex items-center gap-3 border-b border-white/[0.02]"
                  >
                    <div className="w-3.5 h-3.5 border border-gray-700 bg-black/40 rounded flex-shrink-0 flex items-center justify-center hover:border-amber-500/50 transition-colors">
                      {/* Checkbox placeholder */}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="truncate text-white font-medium">{l.name || l.email}</p>
                      <p className="text-[10px] text-gray-600 truncate">{l.company || ''}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected */}
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-[#1e1e1e] flex justify-between items-center">
              <p className="text-xs text-gray-500 font-semibold">{selectedLeadIds.length} Selected</p>
              {selectedLeadIds.length > 0 && (
                <button 
                  onClick={removeAllSelected}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto bg-amber-500/[0.02]">
              {selectedLeads.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-500 text-center italic">Click leads on the left to add</p>
              ) : (
                selectedLeads.map((l) => (
                  <div
                    key={l.id}
                    className="w-full px-3 py-2 text-xs text-amber-400 flex items-center justify-between hover:bg-red-500/10 group border-b border-amber-500/5 rotate-in"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-3.5 h-3.5 bg-amber-500 rounded-sm flex-shrink-0 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div className="truncate">
                        <p className="truncate font-medium">{l.name || l.email}</p>
                        <p className="text-[10px] text-amber-500/40 truncate">{l.company || ''}</p>
                      </div>
                    </div>
                    <button onClick={() => removeLead(l.id)} className="text-gray-600 group-hover:text-red-400 p-1">
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Delay settings */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Min Delay (seconds): {form.delay_min}s</label>
            <input
              type="range"
              min="5"
              max="300"
              value={form.delay_min}
              onChange={(e) => setForm({ ...form, delay_min: parseInt(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Max Delay (seconds): {form.delay_max}s</label>
            <input
              type="range"
              min="5"
              max="600"
              value={form.delay_max}
              onChange={(e) => setForm({ ...form, delay_max: parseInt(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        {/* ── Follow-Up Settings ────────────────────────── */}
        <div className="border border-[#1e1e1e] rounded-lg p-4 mb-4 bg-[#0d0d0d]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Timer size={16} className="text-blue-400" />
              <h4 className="text-sm font-semibold text-white">Follow-Up Settings</h4>
            </div>
            <button
              onClick={() => setForm({ ...form, followup_enabled: !form.followup_enabled })}
              className="flex items-center gap-1.5 text-xs"
            >
              {form.followup_enabled ? (
                <ToggleRight size={22} className="text-blue-400" />
              ) : (
                <ToggleLeft size={22} className="text-gray-600" />
              )}
              <span className={form.followup_enabled ? 'text-blue-400' : 'text-gray-600'}>
                {form.followup_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>
          </div>

          {form.followup_enabled && (
            <div className="space-y-4 animate-fade-in">
              {/* Follow-up 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Follow-Up 1 — Delay: <span className="text-blue-400">{form.followup1_delay_days} days</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={form.followup1_delay_days}
                    onChange={(e) => setForm({ ...form, followup1_delay_days: parseInt(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Follow-Up 1 — Template</label>
                  <select
                    value={form.followup1_template_id}
                    onChange={(e) => setForm({ ...form, followup1_template_id: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Follow-up 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Follow-Up 2 — Delay: <span className="text-blue-400">{form.followup2_delay_days} days</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={form.followup2_delay_days}
                    onChange={(e) => setForm({ ...form, followup2_delay_days: parseInt(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Follow-Up 2 — Template</label>
                  <select
                    value={form.followup2_template_id}
                    onChange={(e) => setForm({ ...form, followup2_template_id: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Auto-Scrape Settings ──────────────────────── */}
        <div className="border border-[#1e1e1e] rounded-lg p-4 mb-5 bg-[#0d0d0d]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-green-400" />
              <h4 className="text-sm font-semibold text-white">Auto-Scrape (Daily)</h4>
            </div>
            <button
              onClick={() => setForm({ ...form, auto_scrape_enabled: !form.auto_scrape_enabled })}
              className="flex items-center gap-1.5 text-xs"
            >
              {form.auto_scrape_enabled ? (
                <ToggleRight size={22} className="text-green-400" />
              ) : (
                <ToggleLeft size={22} className="text-gray-600" />
              )}
              <span className={form.auto_scrape_enabled ? 'text-green-400' : 'text-gray-600'}>
                {form.auto_scrape_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>
          </div>

          {form.auto_scrape_enabled && (
            <div className="animate-fade-in">
              <label className="block text-xs text-gray-500 mb-1.5">
                Auto Scrape Query — runs daily at 8am UTC
              </label>
              <input
                value={form.auto_scrape_query}
                onChange={(e) => setForm({ ...form, auto_scrape_query: e.target.value })}
                placeholder='e.g. "painters decorators Manchester"'
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !form.name || !form.template_id || selectedLeadIds.length === 0}
          className="px-5 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 text-sm"
        >
          {creating ? 'Creating…' : 'Create Campaign'}
        </button>
      </div>

      {/* ── Campaign Cards ──────────────────────────────── */}
      <div className="space-y-4">
        {campaigns.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-12">No campaigns yet. Create one above.</p>
        )}
        {campaigns.map((c) => {
          const pct = c.total_leads > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_leads) * 100) : 0;
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} className="glass-card overflow-hidden animate-fade-in">
              {/* Card header */}
              <div
                className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleExpand(c.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-white">{c.name}</h4>
                    <StatusBadge status={c.status} />
                    {c.followup_enabled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        Follow-ups
                      </span>
                    )}
                    {c.auto_scrape_enabled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20 flex items-center gap-1">
                        <RefreshCw size={9} /> Auto-Scrape
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Actions */}
                    {(c.status === 'draft' || c.status === 'paused') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLaunch(c.id); }}
                        className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        title="Launch"
                      >
                        <Play size={14} />
                      </button>
                    )}
                    {c.status === 'running' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePause(c.id); }}
                        className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                        title="Pause"
                      >
                        <Pause size={14} />
                      </button>
                    )}
                    {(c.status === 'running' || c.status === 'paused') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStop(c.id); }}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        title="Stop"
                      >
                        <Square size={14} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs text-gray-500 mb-2">
                  <span>Template: <span className="text-gray-300">{c.templates?.name || '—'}</span></span>
                  <span>Total: <span className="text-white">{c.total_leads}</span></span>
                  <span>Sent: <span className="text-green-400">{c.sent_count}</span></span>
                  <span>Failed: <span className="text-red-400">{c.failed_count}</span></span>
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>

                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-[#1e1e1e] animate-fade-in">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1e1e1e] text-gray-500">
                          <th className="px-5 py-2.5 text-left font-medium">Lead Email</th>
                          <th className="px-5 py-2.5 text-left font-medium">Sender</th>
                          <th className="px-5 py-2.5 text-left font-medium">Status</th>
                          <th className="px-5 py-2.5 text-left font-medium">Sent At</th>
                          <th className="px-5 py-2.5 text-left font-medium">Error</th>
                          <th className="px-5 py-2.5 text-left font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedLeads.length === 0 ? (
                          <tr><td colSpan={6} className="px-5 py-4 text-center text-gray-500">No leads</td></tr>
                        ) : (
                          expandedLeads.map((cl) => (
                            <tr key={cl.id} className="border-b border-[#1e1e1e]">
                              <td className="px-5 py-2 text-white font-mono">{cl.leads?.email || '—'}</td>
                              <td className="px-5 py-2 text-gray-500">{cl.accounts?.email || '—'}</td>
                              <td className="px-5 py-2"><StatusBadge status={cl.status} /></td>
                              <td className="px-5 py-2 text-gray-500">
                                {cl.sent_at ? new Date(cl.sent_at).toLocaleString() : '—'}
                              </td>
                              <td className="px-5 py-2 text-red-400 max-w-xs truncate">{cl.error || ''}</td>
                              <td className="px-5 py-2">
                                {cl.status === 'sent' && (
                                  <button
                                    onClick={() => handleMarkReplied(c.id, cl.lead_id)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                                    title="Mark as replied — skips pending follow-ups"
                                  >
                                    <MailCheck size={11} />
                                    Mark Replied
                                  </button>
                                )}
                                {cl.status === 'replied' && (
                                  <span className="text-[11px] text-blue-400 flex items-center gap-1">
                                    <MailCheck size={11} /> Replied
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
