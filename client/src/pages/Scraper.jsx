import { useState, useEffect, useRef } from 'react';
import {
  Globe, Search, Loader2, CheckCircle2, AlertCircle,
  MapPin, ExternalLink, Mail, Phone, Building2, ChevronDown, Map,
} from 'lucide-react';
import { getCampaigns, getScraperConfig, updateScraperConfig } from '../api';

const BASE = import.meta.env.VITE_API_URL;

const SOURCES = [
  { key: 'google_maps', label: 'Google Maps Native', color: '#4285F4', icon: '🗺️' },
  { key: 'google_search', label: 'Google Search Native', color: '#EA4335', icon: '🔍' },
];

export default function Scraper() {
  const [query, setQuery] = useState(() => localStorage.getItem('scraper_query') || '');
  const [campaignId, setCampaignId] = useState(() => localStorage.getItem('scraper_campaignId') || '');
  const [campaigns, setCampaigns] = useState([]);
  const [selectedSources, setSelectedSources] = useState(() => {
    try { return JSON.parse(localStorage.getItem('scraper_sources')) || SOURCES.map(s => s.key); } catch { return SOURCES.map(s => s.key); }
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(() => { try { return JSON.parse(localStorage.getItem('scraper_result')) || null; } catch { return null; } });
  const [error, setError] = useState('');
  const [logs, setLogs] = useState(() => { try { return JSON.parse(localStorage.getItem('scraper_logs')) || []; } catch { return []; } });
  const logsEndRef = useRef(null);

  // Multi-city progress state
  const [cityProgress, setCityProgress] = useState(() => { try { return JSON.parse(localStorage.getItem('scraper_cityProgress')) || null; } catch { return null; } });
  const [mode, setMode] = useState(() => localStorage.getItem('scraper_mode') || null);
  const [completedCities, setCompletedCities] = useState(() => { try { return JSON.parse(localStorage.getItem('scraper_completedCities')) || []; } catch { return []; } });
  
  // Scheduler Config State
  const [schedQuery, setSchedQuery] = useState('');
  const [schedEnabled, setSchedEnabled] = useState(true);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedMsg, setSchedMsg] = useState(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem('scraper_query', query);
    localStorage.setItem('scraper_campaignId', campaignId);
    localStorage.setItem('scraper_sources', JSON.stringify(selectedSources));
    localStorage.setItem('scraper_logs', JSON.stringify(logs));
    localStorage.setItem('scraper_cityProgress', JSON.stringify(cityProgress));
    localStorage.setItem('scraper_mode', mode || '');
    localStorage.setItem('scraper_completedCities', JSON.stringify(completedCities));
    if (result) localStorage.setItem('scraper_result', JSON.stringify(result));
    else localStorage.removeItem('scraper_result');
  }, [query, campaignId, selectedSources, logs, cityProgress, mode, completedCities, result]);

  useEffect(() => {
    getCampaigns()
      .then(setCampaigns)
      .catch(() => {});

    getScraperConfig()
      .then(cfg => {
        setSchedQuery(cfg.query);
        setSchedEnabled(cfg.enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const toggleSource = (key) => {
    setSelectedSources(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleScrape = async () => {
    if (!query.trim()) return;
    if (selectedSources.length === 0) {
      setError('Select at least one source.');
      return;
    }

    setLoading(true);
    setError('');
    
    // Always start fresh when clicked
    setResult(null);
    setLogs([]);
    setCityProgress(null);
    setMode(null);
    setCompletedCities([]);

    // Build SSE URL
    const params = new URLSearchParams({
      query: query.trim(),
      sources: selectedSources.join(','),
    });
    if (campaignId) params.set('campaign_id', campaignId);

    const url = `${BASE}/api/scraper/stream?${params.toString()}`;

    try {
      const eventSource = new EventSource(url);

      // Backend 10-second health check
      let sseTimeoutId = setTimeout(() => {
        setError('Backend not responding — is the server running?');
        setLoading(false);
        eventSource.close();
      }, 10000);

      eventSource.onmessage = (event) => {
        clearTimeout(sseTimeoutId);
        
        try {
          const parsed = JSON.parse(event.data);

          switch (parsed.type) {
            case 'mode':
              setMode(parsed.data.mode);
              if (parsed.data.mode === 'multi_city') {
                setLogs(prev => [
                  ...prev,
                  `[${new Date().toLocaleTimeString()}] 🏙️ Multi-city mode: scraping ${parsed.data.totalCities} UK cities`,
                ]);
              }
              break;

            case 'log':
              setLogs(prev => [...prev, parsed.data]);
              break;

            case 'city_progress':
              setCityProgress(parsed.data);
              break;

            case 'city_done':
              setCityProgress(parsed.data);
              setCompletedCities(prev => [
                ...prev,
                { city: parsed.data.city, totalFound: parsed.data.totalFound },
              ]);
              break;

            case 'complete':
              setResult(parsed.data);
              setLogs(parsed.data.logs || []);
              setLoading(false);
              eventSource.close();
              break;

            case 'error':
              setError(parsed.data);
              setLoading(false);
              eventSource.close();
              break;
          }
        } catch { /* ignore parse errors */ }
      };

      eventSource.onerror = () => {
        // If we already have a result, the connection closed normally
        if (!loading) return;
        setError('Connection lost. The scrape may still be running on the server.');
        setLoading(false);
        eventSource.close();
      };
    } catch (err) {
      setError(err.message || 'Scraper failed');
      setLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSchedLoading(true);
    setSchedMsg(null);
    try {
      await updateScraperConfig({ query: schedQuery, enabled: schedEnabled });
      setSchedMsg({ type: 'success', text: '✓ Schedule saved successfully.' });
      setTimeout(() => setSchedMsg(null), 3000);
    } catch (err) {
      setSchedMsg({ type: 'error', text: `✗ ${err.message}` });
    } finally {
      setSchedLoading(false);
    }
  };

  const totalSourceResults = result?.sourceCounts
    ? Object.values(result.sourceCounts).reduce((a, b) => a + b, 0)
    : 0;

  const clearSession = () => {
    localStorage.removeItem('scraper_query');
    localStorage.removeItem('scraper_campaignId');
    localStorage.removeItem('scraper_sources');
    localStorage.removeItem('scraper_logs');
    localStorage.removeItem('scraper_cityProgress');
    localStorage.removeItem('scraper_mode');
    localStorage.removeItem('scraper_completedCities');
    localStorage.removeItem('scraper_result');
    setQuery('');
    setCampaignId('');
    setSelectedSources(SOURCES.map(s => s.key));
    setLogs([]);
    setCityProgress(null);
    setMode(null);
    setCompletedCities([]);
    setResult(null);
  };

  const cityPct = cityProgress
    ? Math.round((cityProgress.cityIndex / cityProgress.totalCities) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
            <Globe size={22} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Lead Scraper</h2>
            <p className="text-xs text-gray-500 mt-0.5">Multi-source, multi-city lead discovery engine</p>
          </div>
        </div>
        {(logs.length > 0 || result || cityProgress) && (
          <button
            onClick={clearSession}
            title="Wipe saved session data completely and start fresh"
            className="text-xs font-medium bg-[#1e1e1e] hover:bg-[#2c2c2c] text-white px-4 py-2 rounded flex items-center gap-2 border border-gray-700 transition"
          >
            Clear Session
          </button>
        )}
      </div>

      {/* ── Search Form ─────────────────────────────────── */}
      <div className="glass-card p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
          Search Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Query */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Search Query</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                id="scraper-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "painters decorators" (auto-searches 28 UK cities)'
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
              />
            </div>
            <p className="text-[11px] text-gray-600 mt-1">
              <span className="text-amber-500/70">No city?</span> Auto-scrapes all 28 UK cities · <span className="text-gray-500">Add a city name to search single city only</span>
            </p>
          </div>

          {/* Campaign selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Add to Campaign <span className="text-gray-600">(optional)</span>
            </label>
            <div className="relative">
              <select
                id="scraper-campaign"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-sm text-white appearance-none cursor-pointer"
              >
                <option value="">None — save leads only</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Source Checkboxes ────────────────────────────── */}
        <label className="block text-xs text-gray-500 mb-2">Scraping Sources</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {SOURCES.map((src) => {
            const active = selectedSources.includes(src.key);
            return (
              <button
                key={src.key}
                id={`source-${src.key}`}
                onClick={() => toggleSource(src.key)}
                className="group flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-200"
                style={{
                  borderColor: active ? src.color + '44' : '#1e1e1e',
                  background: active ? src.color + '12' : '#0d0d0d',
                  color: active ? src.color : '#666',
                }}
              >
                <span className="text-base">{src.icon}</span>
                <span>{src.label}</span>
                {active && (
                  <CheckCircle2 size={14} style={{ color: src.color }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Scrape Button ───────────────────────────────── */}
        <button
          id="scrape-button"
          onClick={handleScrape}
          disabled={loading || !query.trim() || selectedSources.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold rounded-lg hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Scraping in progress…
            </>
          ) : (
            <>
              <Search size={16} />
              Scrape Leads
            </>
          )}
        </button>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
      </div>

      {/* ── Scheduler Settings ─────────────────────────── */}
      <div className="glass-card p-5 mb-6 border-l-4 border-amber-500/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Daily 2AM Scraper Settings
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${schedEnabled ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {schedEnabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-7">
            <label className="block text-xs text-gray-500 mb-1.5">Tonight's Scrape Query</label>
            <input
              value={schedQuery}
              onChange={(e) => setSchedQuery(e.target.value)}
              placeholder='e.g. "painters decorators"'
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 outline-none"
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-3 pb-2.5">
            <button
              onClick={() => setSchedEnabled(!schedEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${schedEnabled ? 'bg-amber-500' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${schedEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-xs text-gray-400">Auto-scrape enabled</span>
          </div>
          <div className="md:col-span-2">
            <button
              onClick={handleSaveSchedule}
              disabled={schedLoading}
              className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/10 transition disabled:opacity-50"
            >
              {schedLoading ? 'SAVING...' : 'SAVE SCHEDULE'}
            </button>
          </div>
        </div>
        {schedMsg && (
          <p className={`mt-3 text-[11px] font-medium transition-all ${schedMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {schedMsg.text}
          </p>
        )}
      </div>

      {/* ── Multi-City Progress ──────────────────────────── */}
      {loading && mode === 'multi_city' && cityProgress && (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Map size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-white">
                Scraping <span className="text-amber-400">{cityProgress.city}</span>
              </h3>
            </div>
            <span className="text-xs font-mono text-amber-400">
              {cityProgress.cityIndex}/{cityProgress.totalCities}
            </span>
          </div>

          {/* City progress bar */}
          <div className="progress-bar mb-3" style={{ height: '8px' }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${cityPct}%`,
                transition: 'width 0.5s ease',
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>
                Cities done: <span className="text-green-400 font-bold">{completedCities.length}</span>
              </span>
              <span>
                Leads found: <span className="text-amber-400 font-bold">{cityProgress.totalFound || 0}</span>
              </span>
            </div>
            <span className="text-xs text-gray-600">{cityPct}% complete</span>
          </div>

          {/* City chips showing progress */}
          {completedCities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#1e1e1e]">
              {completedCities.map((c, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/15"
                >
                  {c.city} ✓
                </span>
              ))}
              {cityProgress && !completedCities.find(c => c.city === cityProgress.city) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse-amber">
                  {cityProgress.city} ⟳
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Progress Log ──────────────────────────────────── */}
      {(loading || logs.length > 0) && (
        <div className="glass-card mb-6 overflow-hidden animate-fade-in">
          <div className="px-5 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Progress Log
            </h3>
            <div className="flex items-center gap-3">
              {loading && cityProgress && (
                <span className="text-xs text-gray-500">
                  {cityProgress.totalFound || 0} leads found
                </span>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <Loader2 size={12} className="animate-spin" />
                  Running…
                </div>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto bg-[#080808] px-5 py-3 font-mono text-xs leading-relaxed">
            {logs.map((line, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  line.includes('✓') ? 'text-green-400' :
                  line.includes('⚠') ? 'text-yellow-400' :
                  line.includes('Error') || line.includes('ERROR') ? 'text-red-400' :
                  line.includes('✦') ? 'text-amber-400 font-semibold' :
                  line.includes('━━━') ? 'text-cyan-400 font-semibold' :
                  line.includes('🏙️') ? 'text-purple-400 font-semibold' :
                  line.includes('══') ? 'text-amber-400' :
                  'text-gray-500'
                }`}
              >
                {line}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* ── Results Summary ───────────────────────────────── */}
      {result && (
        <div className="animate-fade-in">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard
              label="Found"
              value={result.found}
              color="text-blue-400"
              bg="from-blue-500/10 to-blue-600/5"
              border="border-blue-500/20"
            />
            <StatCard
              label="Saved"
              value={result.saved}
              color="text-green-400"
              bg="from-green-500/10 to-green-600/5"
              border="border-green-500/20"
            />
            <StatCard
              label="Skipped"
              value={result.skipped}
              color="text-yellow-400"
              bg="from-yellow-500/10 to-yellow-600/5"
              border="border-yellow-500/20"
            />
            <StatCard
              label="Sources"
              value={totalSourceResults}
              color="text-purple-400"
              bg="from-purple-500/10 to-purple-600/5"
              border="border-purple-500/20"
            />
            {result.citiesScraped && (
              <StatCard
                label="Cities"
                value={result.citiesScraped}
                color="text-cyan-400"
                bg="from-cyan-500/10 to-cyan-600/5"
                border="border-cyan-500/20"
              />
            )}
          </div>

          {/* Per-source breakdown */}
          {result.sourceCounts && Object.keys(result.sourceCounts).length > 0 && (
            <div className="glass-card p-4 mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Results by Source {result.citiesScraped ? `(across ${result.citiesScraped} cities)` : ''}
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(result.sourceCounts).map(([name, count]) => {
                  const src = SOURCES.find(s => s.label === name);
                  return (
                    <div
                      key={name}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
                      style={{
                        borderColor: (src?.color || '#666') + '33',
                        background: (src?.color || '#666') + '0D',
                      }}
                    >
                      <span>{src?.icon || '📊'}</span>
                      <span className="text-gray-300">{name}:</span>
                      <span className="font-bold" style={{ color: src?.color || '#888' }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Results Table ─────────────────────────────── */}
          {result.emails && result.emails.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1e1e1e]">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Scraped Leads ({result.emails.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e1e1e] text-gray-500">
                      <th className="px-5 py-3 text-left font-medium">#</th>
                      <th className="px-5 py-3 text-left font-medium">
                        <div className="flex items-center gap-1"><Mail size={12} /> Email</div>
                      </th>
                      <th className="px-5 py-3 text-left font-medium">
                        <div className="flex items-center gap-1"><Building2 size={12} /> Business</div>
                      </th>
                      <th className="px-5 py-3 text-left font-medium">
                        <div className="flex items-center gap-1"><Phone size={12} /> Phone</div>
                      </th>
                      <th className="px-5 py-3 text-left font-medium">
                        <div className="flex items-center gap-1"><MapPin size={12} /> City</div>
                      </th>
                      <th className="px-5 py-3 text-left font-medium">Source</th>
                      <th className="px-5 py-3 text-left font-medium">
                        <div className="flex items-center gap-1"><ExternalLink size={12} /> Website</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.emails.map((lead, i) => {
                      const src = SOURCES.find(s => s.label === lead.source);
                      return (
                        <tr key={i} className="border-b border-[#1e1e1e] hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-2.5 text-gray-600">{i + 1}</td>
                          <td className="px-5 py-2.5">
                            <span className="text-amber-400 font-mono">{lead.email}</span>
                          </td>
                          <td className="px-5 py-2.5 text-white">
                            {lead.name || '—'}
                          </td>
                          <td className="px-5 py-2.5 text-gray-400">
                            {lead.phone || '—'}
                          </td>
                          <td className="px-5 py-2.5 text-gray-400">
                            {lead.city || '—'}
                          </td>
                          <td className="px-5 py-2.5">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: (src?.color || '#666') + '20',
                                color: src?.color || '#888',
                              }}
                            >
                              {lead.source}
                            </span>
                          </td>
                          <td className="px-5 py-2.5">
                            {lead.website ? (
                              <a
                                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[200px] inline-block"
                              >
                                {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 35)}
                              </a>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.emails && result.emails.length === 0 && (
            <div className="glass-card p-12 text-center">
              <AlertCircle size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No emails found. Try a different search query or enable more sources.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg, border }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${bg} border ${border} p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
