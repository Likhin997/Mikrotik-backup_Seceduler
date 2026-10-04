import React, { useState, useEffect } from 'react';
import { X, Server, Shield, Clock, HelpCircle, Check, AlertCircle, RefreshCw, Activity } from 'lucide-react';
import { RouterDevice } from '../types';
import { api } from '../services/api';

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
  const [osVersion, setOsVersion] = useState<'v7' | 'v6'>('v7');
  const [protocol, setProtocol] = useState<'push_webhook' | 'rest_api' | 'api_binary'>('rest_api');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [useTls, setUseTls] = useState(true);
  const [scheduleFrequency, setScheduleFrequency] = useState<'hourly' | '6hours' | 'daily' | 'weekly' | 'manual'>('daily');
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [retentionCount, setRetentionCount] = useState(15);
  const [enabled, setEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!ipHost.trim()) {
      setTestResult({ success: false, message: 'Masukkan IP Address / Hostname router terlebih dahulu' });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await api.testConnection({
        ipHost: ipHost.trim(),
        port: Number(port) || (osVersion === 'v6' ? 8728 : 443),
        useTls,
        username: username.trim() || 'admin',
        password: password || undefined
      });
      setTestResult({ success: true, message: res.message });
      if (res.model && !model) {
        setModel(res.model);
      }
      if (res.identity && !name) {
        setName(res.identity);
      }
      if (res.version?.startsWith('6.')) {
        setOsVersion('v6');
        if (port === 443 || port === 80) setPort(8728);
      } else if (res.version?.startsWith('7.')) {
        setOsVersion('v7');
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Gagal menghubungi router' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleVersionChange = (newVer: 'v7' | 'v6') => {
    setOsVersion(newVer);
    if (newVer === 'v6') {
      if (port === 443 || port === 80) setPort(8728);
      if (protocol === 'rest_api') setProtocol('api_binary');
    } else {
      if (port === 8728) setPort(443);
      if (protocol === 'api_binary') setProtocol('rest_api');
    }
  };

  useEffect(() => {
    if (initialDevice) {
      setName(initialDevice.name);
      setModel(initialDevice.model || '');
      setIpHost(initialDevice.ipHost);
      setPort(initialDevice.port || 443);
      setOsVersion(initialDevice.osVersion || (initialDevice.port === 8728 ? 'v6' : 'v7'));
      setProtocol(initialDevice.protocol as any || 'rest_api');
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
      setOsVersion('v7');
      setProtocol('rest_api');
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
      setError('IP address atau Host wajib diisi');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        model: model.trim() || undefined,
        ipHost: ipHost.trim(),
        port: Number(port) || (osVersion === 'v6' ? 8728 : 443),
        protocol,
        osVersion,
        username: username.trim() || 'admin',
        password: password || undefined,
        useTls,
        scheduleFrequency,
        scheduleTime,
        retentionCount: Number(retentionCount) || 15,
        enabled
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan pengaturan router');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {initialDevice ? 'Ubah Pengaturan Router' : 'Tambah Router MikroTik Baru'}
              </h3>
              <p className="text-xs text-slate-500">
                Konfigurasi penjadwalan dan integrasi backup otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Router Name & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Router / Identitas <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="misal: RB4011-Core-Gateway"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Model Hardware / Versi
              </label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="misal: RB4011 / CCR2004 / CHR"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>
          </div>

          {/* IP / Host & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                IP Address / Hostname <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={ipHost}
                onChange={e => setIpHost(e.target.value)}
                placeholder="192.168.88.1 atau vpn.kantor.com"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Port</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {protocol === 'rest_api' ? 'REST/SSL' : 'Web/Winbox'}
                </span>
              </label>
              <input
                type="number"
                value={port}
                onChange={e => setPort(Number(e.target.value))}
                min="1"
                max="65535"
                placeholder="443"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>
          </div>

          {/* RouterOS Version Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Versi RouterOS MikroTik</span>
              <span className="text-[11px] text-slate-500 font-normal">Pilih sesuai versi router Anda</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleVersionChange('v7')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center space-x-1.5 cursor-pointer ${
                  osVersion === 'v7'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>RouterOS v7 (Modern)</span>
                {osVersion === 'v7' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                type="button"
                onClick={() => handleVersionChange('v6')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center space-x-1.5 cursor-pointer ${
                  osVersion === 'v6'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>RouterOS v6 (CCR / RB Series)</span>
                {osVersion === 'v6' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            </div>
          </div>

          {/* Backup Mode / Protocol */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Metode Penarikan Backup</span>
              <span className="text-[11px] text-blue-600 font-bold">
                {osVersion === 'v6' ? 'Rekomendasi: RouterOS API port 8728' : 'Rekomendasi: REST API v7'}
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {osVersion === 'v7' ? (
                <button
                  type="button"
                  onClick={() => setProtocol('rest_api')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    protocol === 'rest_api'
                      ? 'border-blue-500 bg-blue-50/70 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">REST API v7 (Pull Otomatis)</span>
                    {protocol === 'rest_api' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Server menarik langsung seluruh konfigurasi asli (.rsc) pada jadwal yang ditentukan. Termasuk VLAN & DHCP Server.
                  </p>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setProtocol('api_binary')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    protocol === 'api_binary'
                      ? 'border-blue-500 bg-blue-50/70 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">RouterOS API v6 (Port 8728)</span>
                    {protocol === 'api_binary' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Koneksi langsung ke port 8728 API RouterOS v6. Menarik VLAN, DHCP, IP, Firewall secara lengkap.
                  </p>
                </button>
              )}

              <button
                type="button"
                onClick={() => setProtocol('push_webhook')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  protocol === 'push_webhook'
                    ? 'border-blue-500 bg-blue-50/70 text-slate-900 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Webhook Push (Skrip Scheduler)</span>
                  {protocol === 'push_webhook' && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  RouterOS menjalankan skrip internal dan mengirim file via <code className="text-blue-700 font-semibold">/tool fetch</code>. Cocok jika router di balik NAT.
                </p>
              </button>
            </div>
          </div>

          {/* Router Credentials & Test Connection */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-800 font-bold">Kredensial Login MikroTik (Untuk Tarik Config Asli):</p>
              <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useTls}
                  onChange={e => setUseTls(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span>Gunakan HTTPS (SSL)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Username Login</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Password Login {initialDevice ? '(Kosongkan jika tak berubah)' : ''}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-60 shrink-0"
              >
                {testingConnection ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Menguji Koneksi ke MikroTik...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span>Uji Koneksi Router Sekarang</span>
                  </>
                )}
              </button>

              <span className="text-[11px] text-slate-500">
                Memastikan port dan login valid sebelum jadwal otomatis berjalan
              </span>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start space-x-2 border animate-in fade-in duration-150 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Schedule Frequency & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Frekuensi Jadwal Backup
              </label>
              <select
                value={scheduleFrequency}
                onChange={e => setScheduleFrequency(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Jam Eksekusi Harian</span>
                  <span className="text-[11px] text-blue-600 font-bold">WIB (Asia/Jakarta)</span>
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Pencadangan otomatis akan dieksekusi tepat pada jam ini (Waktu Indonesia Barat / UTC+7)
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Retensi File (Pruning)
              </label>
              <select
                value={retentionCount}
                onChange={e => setRetentionCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
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
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="deviceEnabled"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 bg-white border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="deviceEnabled" className="text-xs text-slate-700 cursor-pointer font-semibold">
              Aktifkan otomatisasi backup untuk router ini
            </label>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Menyimpan...' : initialDevice ? 'Simpan Perubahan' : 'Tambah Router'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
