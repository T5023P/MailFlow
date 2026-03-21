import { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, FileText, Eye } from 'lucide-react';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getLeads } from '../api';

const VARIABLES = ['{{name}}', '{{company}}', '{{city}}', '{{service}}', '{{custom1}}', '{{custom2}}'];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [originalForm, setOriginalForm] = useState({ name: '', subject: '', body: '' });
  const [leads, setLeads] = useState([]);
  const [previewLead, setPreviewLead] = useState(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

  const fetchTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await getLeads(1, 100);
      setLeads(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchTemplates(); fetchLeads(); }, []);

  const handleSelect = (tpl) => {
    setSelected(tpl);
    const f = { name: tpl.name, subject: tpl.subject, body: tpl.body };
    setForm(f);
    setOriginalForm(f);
    setPreviewLead(null);
  };

  const handleNew = () => {
    setSelected(null);
    setForm({ name: '', subject: '', body: '' });
    setOriginalForm({ name: '', subject: '', body: '' });
    setPreviewLead(null);
  };

  const hasChanges = form.name !== originalForm.name || form.subject !== originalForm.subject || form.body !== originalForm.body;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selected) {
        await updateTemplate(selected.id, form);
      } else {
        await createTemplate(form);
      }
      await fetchTemplates();
      if (!selected) handleNew();
      else {
        setOriginalForm({ ...form });
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteTemplate(selected.id);
    handleNew();
    fetchTemplates();
  };

  const insertVariable = (variable) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newBody = form.body.substring(0, start) + variable + form.body.substring(end);
    setForm({ ...form, body: newBody });
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + variable.length;
    }, 0);
  };

  const personalize = (text) => {
    if (!previewLead || !text) return text || '';
    return text
      .replace(/\{\{name\}\}/gi, previewLead.name || '')
      .replace(/\{\{email\}\}/gi, previewLead.email || '')
      .replace(/\{\{company\}\}/gi, previewLead.company || '')
      .replace(/\{\{city\}\}/gi, previewLead.city || '')
      .replace(/\{\{service\}\}/gi, previewLead.service || '')
      .replace(/\{\{custom1\}\}/gi, previewLead.custom1 || '')
      .replace(/\{\{custom2\}\}/gi, previewLead.custom2 || '');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Templates</h2>

      <div className="flex gap-6 h-[calc(100vh-180px)]">
        {/* ── Left panel: Template list ────────────────── */}
        <div className="w-64 flex-shrink-0 glass-card flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#1e1e1e]">
            <button
              onClick={handleNew}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 text-sm"
            >
              <Plus size={15} /> New Template
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleSelect(tpl)}
                className={`w-full text-left px-4 py-3 border-b border-[#1e1e1e] transition-colors flex items-center gap-2 ${
                  selected?.id === tpl.id ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <FileText size={14} className="flex-shrink-0 opacity-50" />
                <span className="text-sm truncate">{tpl.name}</span>
              </button>
            ))}
            {templates.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted text-center">No templates yet</p>
            )}
          </div>
        </div>

        {/* ── Right panel: Editor ──────────────────────── */}
        <div className="flex-1 glass-card flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[#1e1e1e] space-y-4">
            {/* Template Name */}
            <div>
              <label className="block text-xs text-muted mb-1.5">Template Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Cold Outreach v1"
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
            {/* Subject */}
            <div>
              <label className="block text-xs text-muted mb-1.5">Subject Line</label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Quick question about {{company}}"
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 font-mono"
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 pt-4">
              <label className="block text-xs text-muted mb-1.5">Body</label>
            </div>
            <textarea
              ref={bodyRef}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write your email body here. Use {{variables}} for personalization..."
              className="flex-1 mx-5 mb-3 bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 font-mono resize-none"
            />

            {/* Variable chips */}
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-md text-xs font-mono hover:bg-amber-500/20 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div className="border-t border-[#1e1e1e] p-5">
            <div className="flex items-center gap-3 mb-3">
              <Eye size={14} className="text-muted" />
              <span className="text-xs text-muted uppercase tracking-wider font-semibold">Live Preview</span>
              <select
                value={previewLead?.id || ''}
                onChange={(e) => {
                  const lead = leads.find((l) => l.id === e.target.value);
                  setPreviewLead(lead || null);
                }}
                className="ml-auto bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-2 py-1 text-xs text-white"
              >
                <option value="">Select a lead…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.name || l.email}</option>
                ))}
              </select>
            </div>
            {previewLead ? (
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg p-4 space-y-2">
                <p className="text-xs text-muted">Subject:</p>
                <p className="text-sm text-white font-medium">{personalize(form.subject)}</p>
                <p className="text-xs text-muted mt-3">Body:</p>
                <div className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{personalize(form.body)}</div>
              </div>
            ) : (
              <p className="text-xs text-muted">Pick a lead above to preview personalized email.</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-3 border-t border-[#1e1e1e] flex items-center gap-3">
            {hasChanges && (
              <span className="text-xs text-amber-400 animate-pulse-amber">● Unsaved changes</span>
            )}
            <div className="ml-auto flex gap-2">
              {selected && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.subject || !form.body}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 text-sm"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
