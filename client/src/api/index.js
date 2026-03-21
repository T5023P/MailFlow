const BASE = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Stats ────────────────────────────────────────────
export const getStats = () => request('/api/stats');

// ── Accounts ─────────────────────────────────────────
export const getAccounts = () => request('/api/accounts');
export const addAccount = (data) =>
  request('/api/accounts', { method: 'POST', body: JSON.stringify(data) });
export const toggleAccount = (id, patch) =>
  request(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const deleteAccount = (id) =>
  request(`/api/accounts/${id}`, { method: 'DELETE' });

// ── Leads ────────────────────────────────────────────
export const getLeads = (page = 1, limit = 50) =>
  request(`/api/leads?page=${page}&limit=${limit}`);
export const addLead = (data) =>
  request('/api/leads', { method: 'POST', body: JSON.stringify(data) });
export const bulkAddLeads = (leads) =>
  request('/api/leads/bulk', { method: 'POST', body: JSON.stringify({ leads }) });
export const deleteLead = (id) =>
  request(`/api/leads/${id}`, { method: 'DELETE' });
export const deleteAllLeads = () =>
  request('/api/leads', { method: 'DELETE' });

// ── Templates ────────────────────────────────────────
export const getTemplates = () => request('/api/templates');
export const createTemplate = (data) =>
  request('/api/templates', { method: 'POST', body: JSON.stringify(data) });
export const updateTemplate = (id, data) =>
  request(`/api/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteTemplate = (id) =>
  request(`/api/templates/${id}`, { method: 'DELETE' });

// ── Campaigns ────────────────────────────────────────
export const getCampaigns = () => request('/api/campaigns');
export const createCampaign = (data) =>
  request('/api/campaigns', { method: 'POST', body: JSON.stringify(data) });
export const launchCampaign = (id) =>
  request(`/api/campaigns/${id}/launch`, { method: 'POST' });
export const pauseCampaign = (id) =>
  request(`/api/campaigns/${id}/pause`, { method: 'POST' });
export const stopCampaign = (id) =>
  request(`/api/campaigns/${id}/stop`, { method: 'POST' });
export const getCampaignLeads = (id) =>
  request(`/api/campaigns/${id}/leads`);
