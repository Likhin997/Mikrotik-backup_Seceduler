import {
  RouterDevice,
  BackupRecord,
  SystemStats,
  DiffResponse,
  ScriptResponse,
  ActivityLog,
  AppInfo
} from '../types';

export const api = {
  async getStats(): Promise<SystemStats> {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Gagal memuat statistik sistem');
    return res.json();
  },

  async getDevices(): Promise<RouterDevice[]> {
    const res = await fetch('/api/devices');
    if (!res.ok) throw new Error('Gagal memuat daftar router MikroTik');
    return res.json();
  },

  async getDevice(id: string): Promise<RouterDevice & { backups: BackupRecord[] }> {
    const res = await fetch(`/api/devices/${id}`);
    if (!res.ok) throw new Error('Gagal memuat detail router');
    return res.json();
  },

  async createDevice(data: Partial<RouterDevice>): Promise<RouterDevice> {
    const res = await fetch('/api/devices', {
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
    const res = await fetch(`/api/devices/${id}`, {
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
    const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus router');
  },

  async regenerateToken(id: string): Promise<{ webhookToken: string }> {
    const res = await fetch(`/api/devices/${id}/token`, { method: 'POST' });
    if (!res.ok) throw new Error('Gagal memperbarui token webhook');
    return res.json();
  },

  async getDeviceScript(id: string): Promise<ScriptResponse> {
    const res = await fetch(`/api/devices/${id}/script`);
    if (!res.ok) throw new Error('Gagal memuat skrip RouterOS');
    return res.json();
  },

  async triggerBackupNow(id: string): Promise<{ success: boolean; message: string; backup: BackupRecord }> {
    const res = await fetch(`/api/devices/${id}/backup-now`, { method: 'POST' });
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

    const res = await fetch(`/api/backups?${query.toString()}`);
    if (!res.ok) throw new Error('Gagal memuat riwayat backup');
    return res.json();
  },

  async getBackupDetail(id: string): Promise<BackupRecord> {
    const res = await fetch(`/api/backups/${id}`);
    if (!res.ok) throw new Error('Gagal memuat data isi konfigurasi backup');
    return res.json();
  },

  getDownloadUrl(id: string): string {
    return `/api/backups/${id}/download`;
  },

  async deleteBackup(id: string): Promise<void> {
    const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus file backup');
  },

  async getDiff(id1: string, id2: string): Promise<DiffResponse> {
    const res = await fetch(`/api/backups/${id1}/diff/${id2}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal membandingkan kedua versi backup');
    }
    return res.json();
  },

  async uploadBackup(formData: FormData): Promise<{ success: boolean; message: string; backup: BackupRecord }> {
    const res = await fetch('/api/backups/upload', {
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
    const res = await fetch('/api/logs');
    if (!res.ok) throw new Error('Gagal memuat log aktivitas');
    return res.json();
  },

  async getInfo(): Promise<AppInfo> {
    const res = await fetch('/api/info');
    if (!res.ok) throw new Error('Gagal memuat info aplikasi');
    return res.json();
  }
};
