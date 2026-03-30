import { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Papa from 'papaparse';
import { getLeads, addLead, bulkAddLeads, deleteLead, deleteAllLeads } from '../api';

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-gray-500/20 text-gray-400',
    sent: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', company: '', city: '', service: '', custom1: '', custom2: '' });
  
  // Filter states
  const [niches, setNiches] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [filtersLoading, setFiltersLoading] = useState(false);

  const fileRef = useRef(null);
  const limit = 50;

  const fetchLeads = async () => {
    try {
      const res = await getLeads(page, limit, selectedNiche, selectedDate);
      setLeads(res.data);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFilters = async () => {
    setFiltersLoading(true);
    try {
      const res = await getLeadFilters();
      setNiches(res.niches);
      setDates(res.dates);
    } catch (e) {
      console.error(e);
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => { 
    fetchFilters(); 
  }, []);

  useEffect(() => { 
    fetchLeads(); 
  }, [page, selectedNiche, selectedDate]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: async (results) => {
        const mapped = results.data.map((row) => ({
          email: row.email || '',
          name: row.name || '',
          company: row.company || '',
          city: row.city || '',
          service: row.service || '',
          custom1: row.custom1 || '',
          custom2: row.custom2 || '',
        })).filter((r) => r.email);

        try {
          const res = await bulkAddLeads(mapped);
          showToast(`${res.imported} leads imported, ${res.skipped} duplicates skipped`);
          fetchFilters();
          fetchLeads();
        } catch (err) {
          showToast(`Error: ${err.message}`);
        }
      },
    });
    e.target.value = '';
  };

  const handleAddSingle = async (e) => {
    e.preventDefault();
    try {
      await addLead(form);
      setForm({ email: '', name: '', company: '', city: '', service: '', custom1: '', custom2: '' });
      setShowForm(false);
      showToast('Lead added successfully');
      fetchLeads();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDeleteAll = async () => {
    await deleteAllLeads();
    setConfirmDelete(false);
    setPage(1);
    fetchFilters();
    fetchLeads();
    showToast('All leads deleted');
  };

  const handleDeleteOne = async (id) => {
    await deleteLead(id);
    fetchFilters();
    fetchLeads();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Leads</h2>

      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="file" ref={fileRef} accept=".csv" onChange={handleCSV} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 text-sm"
        >
          <Upload size={15} /> Upload CSV
        </button>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#1e1e1e] text-white rounded-lg hover:border-amber-500/50 text-sm"
        >
          <Plus size={15} /> Add Single Lead
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 text-sm ml-auto"
        >
          <Trash2 size={15} /> Delete All
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-[#111] border border-[#1e1e1e] rounded-xl">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-muted uppercase tracking-wider font-bold ml-1">Filter by Niche</label>
          <select
            value={selectedNiche}
            onChange={(e) => { setSelectedNiche(e.target.value); setPage(1); }}
            className="bg-[#0a0a0a] border border-[#1e1e1e] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-amber-500/50 min-w-[200px]"
          >
            <option value="">All Niches</option>
            {niches.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-muted uppercase tracking-wider font-bold ml-1">Filter by Date</label>
          <select
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
            className="bg-[#0a0a0a] border border-[#1e1e1e] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-amber-500/50 min-w-[150px]"
          >
            <option value="">All Dates</option>
            {dates.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {(selectedNiche || selectedDate) && (
          <button
            onClick={() => { setSelectedNiche(''); setSelectedDate(''); setPage(1); }}
            className="mt-auto mb-1 text-xs text-amber-500 hover:text-amber-400 font-medium px-2 py-1"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirmDelete && (
        <div className="glass-card p-4 mb-4 flex items-center gap-4 border-red-500/30 animate-fade-in">
          <p className="text-sm text-red-400">Are you sure? This will delete all leads permanently.</p>
          <button onClick={handleDeleteAll} className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg font-medium">Confirm</button>
          <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 bg-[#1e1e1e] text-muted text-sm rounded-lg">Cancel</button>
        </div>
      )}

      {/* Add Single Lead Form */}
      {showForm && (
        <form onSubmit={handleAddSingle} className="glass-card p-5 mb-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['email', 'name', 'company', 'city', 'service', 'custom1', 'custom2'].map((field) => (
              <div key={field}>
                <label className="block text-xs text-muted mb-1 capitalize">{field}</label>
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  required={field === 'email'}
                  placeholder={field}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
            ))}
            <div className="flex items-end">
              <button type="submit" className="px-4 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 text-sm">
                Add Lead
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Toast ───────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1a1a1a] border border-[#2a2a2a] text-white px-5 py-3 rounded-xl shadow-2xl animate-toast flex items-center gap-3 z-50">
          <p className="text-sm">{toast}</p>
          <button onClick={() => setToast(null)} className="text-muted hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* ── Leads Table ─────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e1e1e] text-xs text-muted">
          {total} leads total · Page {page} of {totalPages || 1}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-muted text-left">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">City</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No leads yet. Upload a CSV or add one manually.</td></tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="border-b border-[#1e1e1e] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white">{l.name || '—'}</td>
                    <td className="px-5 py-3 text-muted font-mono text-xs">{l.email}</td>
                    <td className="px-5 py-3 text-muted">{l.company || '—'}</td>
                    <td className="px-5 py-3 text-muted">{l.city || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleDeleteOne(l.id)} className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-[#1e1e1e]">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md bg-[#1e1e1e] text-muted hover:text-white disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-muted">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md bg-[#1e1e1e] text-muted hover:text-white disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
