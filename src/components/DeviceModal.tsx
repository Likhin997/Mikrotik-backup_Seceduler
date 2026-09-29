import React, { useState, useEffect } from 'react';
import { X, Server, Shield, Clock, HelpCircle, Check, AlertCircle } from 'lucide-react';
import { RouterDevice } from '../types';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<RouterDevice>) => Promise<void>;
  initialDevice?: RouterDevice | null;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDevice
}) => {
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [ipHost, setIpHost] = useState('');
  const [port, setPort] = useState(443);
  const [protocol, setProtocol] = useState<'push_webhook' | 'rest_api'>('push_webhook');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [useTls, setUseTls] = useState(true);
  const [scheduleFrequency, setScheduleFrequency] = useState<'hourly' | '6hours' | 'daily' | 'weekly' | 'manual'>('daily');
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [retentionCount, setRetentionCount] = useState(15);
  const [enabled, setEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDevice) {
      setName(initialDevice.name);
      setModel(initialDevice.model || '');
      setIpHost(initialDevice.ipHost);
      setPort(initialDevice.port || 443);
      setProtocol(initialDevice.protocol === 'rest_api' ? 'rest_api' : 'push_webhook');
      setUsername(initialDevice.username || 'admin');
      setPassword('');
      setUseTls(initialDevice.useTls !== undefined ? initialDevice.useTls : true);
      setScheduleFrequency(initialDevice.scheduleFrequency || 'daily');
      setScheduleTime(initialDevice.scheduleTime || '02:00');
      setRetentionCount(initialDevice.retentionCount || 15);
      setEnabled(initialDevice.enabled !== undefined ? initialDevice.enabled : true);
    } else {
      setName('');
      setModel('');
      setIpHost('192.168.88.1');
      setPort(443);
      setProtocol('push_webhook');
      setUsername('admin');
      setPassword('');
      setUseTls(true);
      setScheduleFrequency('daily');
      setScheduleTime('02:00');
      setRetentionCount(15);
      setEnabled(true);
    }
    setError(null);
  }, [initialDevice, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama router wajib diisi');
      return;
    }
    if (!ipHost.trim()) {
      setError('IP Address / Host wajib diisi');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        model: model.trim() || 'MikroTik RouterOS',
        ipHost: ipHost.trim(),
        port: Number(port),
        protocol,
        username: protocol === 'rest_api' ? username.trim() : undefined,
        password: protocol === 'rest_api' && password ? password : undefined,
        useTls,
        scheduleFrequency,
        scheduleTime,
        retentionCount: Number(retentionCount),
        enabled
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan router');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {initialDevice ? 'Ubah Pengaturan Router' : 'Tambah Router MikroTik Baru'}
              </h3>
              <p className="text-xs text-slate-400">
                Konfigurasi penjadwalan dan integrasi backup otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Router Name & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nama Router / Identitas <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="misal: RB4011-Core-Gateway"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Model Hardware / Versi
              </label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="misal: RB4011 / CCR2004 / CHR"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* IP / Host & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                IP Address / Hostname <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={ipHost}
                onChange={e => setIpHost(e.target.value)}
                placeholder="192.168.88.1 atau vpn.kantor.com"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={e => setPort(Number(e.target.value))}
                min="1"
                max="65535"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Backup Mode / Protocol */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Metode Backup</span>
              <span className="text-[11px] text-blue-400">Rekomendasi: Webhook Push</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProtocol('push_webhook')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  protocol === 'push_webhook'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white">Webhook Push (Otomatis)</span>
                  {protocol === 'push_webhook' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  RouterOS mengekspor & mengirim backup via <code className="text-cyan-300">/tool fetch</code>. Bekerja meski router di balik NAT/CGNAT/PPPoE.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProtocol('rest_api')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  protocol === 'rest_api'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white">REST API v7 (Pull)</span>
                  {protocol === 'rest_api' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Aplikasi menarik langsung konfigurasi dari router via REST API MikroTik RouterOS v7.1+.
                </p>
              </button>
            </div>
          </div>

          {/* REST API Credentials (if selected) */}
          {protocol === 'rest_api' && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <p className="text-xs text-slate-300 font-medium">Kredensial Login REST API RouterOS:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Username RouterOS</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Password {initialDevice ? '(Kosongkan jika tak berubah)' : ''}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Schedule Frequency & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Frekuensi Jadwal Backup
              </label>
              <select
                value={scheduleFrequency}
                onChange={e => setScheduleFrequency(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="hourly">Tiap 1 Jam</option>
                <option value="6hours">Tiap 6 Jam</option>
                <option value="daily">Harian (Rekomendasi)</option>
                <option value="weekly">Mingguan (Tiap Senin)</option>
                <option value="manual">Manual Saja</option>
              </select>
            </div>

            {scheduleFrequency === 'daily' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Jam Eksekusi Harian
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Batas Retensi File (Pruning)
              </label>
              <select
                value={retentionCount}
                onChange={e => setRetentionCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="7">Simpan 7 backup terakhir</option>
                <option value="15">Simpan 15 backup terakhir (Default)</option>
                <option value="30">Simpan 30 backup terakhir</option>
                <option value="60">Simpan 60 backup terakhir</option>
                <option value="100">Simpan 100 backup terakhir</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                File backup tertua akan dihapus otomatis jika melebihi batas ini
              </p>
            </div>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="deviceEnabled"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 focus:ring-blue-500"
            />
            <label htmlFor="deviceEnabled" className="text-xs text-slate-300 cursor-pointer font-medium">
              Aktifkan otomatisasi backup untuk router ini
            </label>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : initialDevice ? 'Simpan Perubahan' : 'Tambah Router'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
