import {
  RouterDevice,
  BackupRecord,
  SystemStats,
  DiffResponse,
  ScriptResponse,
  ActivityLog,
  AppInfo,
  AuthUser,
  AuthResponse
} from '../types';

const TOKEN_KEY = 'mikrotik_admin_token';

// Callbacks for auth events
type UnauthorizedHandler = () => void;
let onUnauthorizedCallback: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  onUnauthorizedCallback = handler;
};

export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
};

export const removeStoredToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    removeStoredToken();
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  }

  return response;
}

export const api = {
  // Auth API
  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login gagal. Periksa username dan password Anda.');
    }

    const data: AuthResponse = await res.json();
    setStoredToken(data.token);
    return data;
  },

  async checkSession(): Promise<{ authenticated: boolean; user: AuthUser }> {
    const res = await fetchWithAuth('/api/auth/me');
    if (!res.ok) {
      throw new Error('Sesi tidak valid atau telah berakhir.');
    }
    return res.json();
  },

  async logout(): Promise<void> {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } catch {}
    removeStoredToken();
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithAuth('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal mengubah password');
    }

    return res.json();
  },

  // Protected Core APIs
  async getStats(): Promise<SystemStats> {
    const res = await fetchWithAuth('/api/stats');
    if (!res.ok) throw new Error('Gagal memuat statistik sistem');
    return res.json();
  },

  async getDevices(): Promise<RouterDevice[]> {
    const res = await fetchWithAuth('/api/devices');
    if (!res.ok) throw new Error('Gagal memuat daftar router MikroTik');
    return res.json();
  },

  async getDevice(id: string): Promise<RouterDevice & { backups: BackupRecord[] }> {
    const res = await fetchWithAuth(`/api/devices/${id}`);
    if (!res.ok) throw new Error('Gagal memuat detail router');
    return res.json();
  },

  async createDevice(data: Partial<RouterDevice>): Promise<RouterDevice> {
    const res = await fetchWithAuth('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal menambahkan router baru');
    }
    return res.json();
  },

  async updateDevice(id: string, data: Partial<RouterDevice>): Promise<RouterDevice> {
    const res = await fetchWithAuth(`/api/devices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal memperbarui konfigurasi router');
    }
    return res.json();
  },

  async deleteDevice(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/devices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus router');
  },

  async regenerateToken(id: string): Promise<{ webhookToken: string }> {
    const res = await fetchWithAuth(`/api/devices/${id}/token`, { method: 'POST' });
    if (!res.ok) throw new Error('Gagal memperbarui token webhook');
    return res.json();
  },

  async getDeviceScript(id: string): Promise<ScriptResponse> {
    const res = await fetchWithAuth(`/api/devices/${id}/script`);
    if (!res.ok) throw new Error('Gagal memuat skrip RouterOS');
    return res.json();
  },

  async triggerBackupNow(id: string): Promise<{ success: boolean; message: string; backup: BackupRecord }> {
    const res = await fetchWithAuth(`/api/devices/${id}/backup-now`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal memicu backup router');
    }
    return res.json();
  },

  async getBackups(params?: { deviceId?: string; search?: string; type?: string }): Promise<BackupRecord[]> {
    const query = new URLSearchParams();
    if (params?.deviceId) query.set('deviceId', params.deviceId);
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);

    const res = await fetchWithAuth(`/api/backups?${query.toString()}`);
    if (!res.ok) throw new Error('Gagal memuat riwayat backup');
    return res.json();
  },

  async getBackupDetail(id: string): Promise<BackupRecord> {
    const res = await fetchWithAuth(`/api/backups/${id}`);
    if (!res.ok) throw new Error('Gagal memuat data isi konfigurasi backup');
    return res.json();
  },

  getDownloadUrl(id: string): string {
    const token = getStoredToken();
    return `/api/backups/${id}/download${token ? `?authToken=${encodeURIComponent(token)}` : ''}`;
  },

  async deleteBackup(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/backups/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus file backup');
  },

  async getDiff(id1: string, id2: string): Promise<DiffResponse> {
    const res = await fetchWithAuth(`/api/backups/${id1}/diff/${id2}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal membandingkan kedua versi backup');
    }
    return res.json();
  },

  async uploadBackup(formData: FormData): Promise<{ success: boolean; message: string; backup: BackupRecord }> {
    const res = await fetchWithAuth('/api/backups/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal mengunggah file konfigurasi');
    }
    return res.json();
  },

  async getLogs(): Promise<ActivityLog[]> {
    const res = await fetchWithAuth('/api/logs');
    if (!res.ok) throw new Error('Gagal memuat log aktivitas');
    return res.json();
  },

  async getInfo(): Promise<AppInfo> {
    const res = await fetchWithAuth('/api/info');
    if (!res.ok) throw new Error('Gagal memuat info aplikasi');
    return res.json();
  }
};
