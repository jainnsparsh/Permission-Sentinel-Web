// Permission Sentinel - API Service
const API_BASE = 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => request<{ status: string; version: string; knowledge_base_version: string }>('/api/health'),
  purposes: () => request<{ purposes: string[] }>('/api/purposes'),
  capabilities: () => request<{ apk_parsing: boolean; knowledge_base_version: string; max_upload_size_mb: number; supported_formats: string[] }>('/api/capabilities'),

  // Permission Evolution (compare two app versions)
  compareDemo: (scenario: string) => request<import('../types').EvolutionResult>(`/api/compare/demo?scenario=${encodeURIComponent(scenario)}`),
  compareVersions: async (oldFile: File, newFile: File, purpose: string): Promise<import('../types').EvolutionResult> => {
    const fd = new FormData();
    fd.append('old_file', oldFile);
    fd.append('new_file', newFile);
    fd.append('purpose', purpose);
    const res = await fetch(`${API_BASE}/api/compare`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Comparison failed: ${res.status}`);
    }
    return res.json();
  },

  // Demo
  demoApps: () => request<{ apps: unknown[] }>('/api/demo/apps'),
  analyzeDemoApps: () => request<{ analyzed: number; results: unknown[] }>('/api/demo/analyze', { method: 'POST' }),

  // Analysis
  analyzeReport: (data: {
    app_name: string;
    package_name?: string;
    purpose: string;
    purpose_source?: string;
    permissions: string[];
    description?: string;
    version?: string;
    target_sdk?: string;
  }) => request<unknown>('/api/analyze/report', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  analyzeBatch: (apps: unknown[]) => request<{ analyzed: number; results: unknown[] }>('/api/analyze/batch', {
    method: 'POST',
    body: JSON.stringify(apps),
  }),

  analyzeUpload: async (file: File, purpose: string, purposeSource: string = 'user-selected') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);
    formData.append('purpose_source', purposeSource);
    
    const res = await fetch(`${API_BASE}/api/analyze/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  // Apps CRUD
  listApps: () => request<{ apps: unknown[] }>('/api/apps'),
  getApp: (id: string) => request<unknown>(`/api/apps/${id}`),
  deleteApp: (id: string) => request<unknown>(`/api/apps/${id}`, { method: 'DELETE' }),
  deleteAllApps: () => request<unknown>('/api/apps', { method: 'DELETE' }),
  updateNotes: (id: string, notes: string) => request<unknown>(`/api/apps/${id}/notes`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  }),

  // Policies
  listPolicies: () => request<{ policies: unknown[] }>('/api/policies'),
  createPolicy: (data: {
    name: string;
    enabled?: boolean;
    blocked_permissions?: string[];
    allowed_permissions?: string[];
    purpose_specific_rules?: Record<string, unknown>;
    alert_on_special_permissions?: boolean;
    score_threshold?: number | null;
  }) => request<unknown>('/api/policies', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updatePolicy: (id: string, data: Record<string, unknown>) => request<unknown>(`/api/policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deletePolicy: (id: string) => request<unknown>(`/api/policies/${id}`, { method: 'DELETE' }),

  // Exports
  exportAppsCsv: () => `${API_BASE}/api/exports/apps.csv`,
  exportAnalysisJson: (id: string) => `${API_BASE}/api/exports/${id}.json`,
  exportAnalysisCsv: (id: string) => `${API_BASE}/api/exports/${id}.csv`,
};
