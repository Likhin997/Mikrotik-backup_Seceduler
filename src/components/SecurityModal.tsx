import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Plus,
  Trash2,
  Copy,
  Check,
  Save,
  RefreshCw,
  Terminal,
  Globe,
  EyeOff,
  Server
} from 'lucide-react';
import { SecuritySettings, SecuritySettingsResponse } from '../types';
import { api } from '../services/api';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState<'controls' | 'hardening'>('controls');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [runtime, setRuntime] = useState<SecuritySettingsResponse['runtime'] | null>(null);
  const [settings, setSettings] = useState<SecuritySettings>({
    blockScanners: true,
    silentDropUnauthorized: true,
    ipAllowlistEnabled: false,
    allowedIps: ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10'],
    allowRegisteredDeviceIps: true,
    rateLimitPerMinute: 120,
    hideServerFingerprint: true
  });
  const [newIpInput, setNewIpInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setLoading(true);
    api
      .getSecuritySettings()
      .then(res => {
        setSettings(res.settings);
        setRuntime(res.runtime);
      })
      .catch(err => {
        setError(err.message || 'Gagal memuat pengaturan keamanan');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddIp = (ipToAdd?: string) => {
    const val = (ipToAdd ?? newIpInput).trim();
    if (!val) return;
    if (!settings.allowedIps.includes(val)) {
      setSettings(prev => ({ ...prev, allowedIps: [...prev.allowedIps, val] }));
    }
    if (!ipToAdd) setNewIpInput('');
  };

  const handleRemoveIp = (ip: string) => {
    setSettings(prev => ({
      ...prev,
      allowedIps: prev.allowedIps.filter(item => item !== ip)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.updateSecuritySettings(settings);
      setSettings(res.settings);
      onSaved(res.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan pengaturan keamanan');
    } finally {
      setSaving(false);
    }
  };

  const cloudflareSnippet = `# 1. Buat Tunnel di Cloudflare Zero Trust (zero open port di VPS!)
#    Public Hostname -> Service: http://mikrotik-backup:3000
# 2. Jalankan dengan Docker Compose profile tunnel:
CLOUDFLARE_TUNNEL_TOKEN="TEMPEL_TOKEN_TUNNEL_ANDA" \\
TRUST_PROXY=true \\
docker compose --profile tunnel up -d --build

# 3. Tutup semua port publik di VPS (hanya SSH yang boleh terbuka)
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw enable`;

  const sshTailscaleSnippet = `# Opsi A: Akses aman lewat SSH Tunnel (tanpa buka port 3003 di VPS!)
ssh -N -L 3003:127.0.0.1:3003 root@IP_VPS_ANDA
# Lalu buka di browser laptop: http://localhost:3003

# Opsi B: Bind khusus ke IP VPN Tailscale / WireGuard saja (tidak terlihat Shodan)
BIND_IP=$(tailscale ip -4) docker compose up -d

# Pastikan port 3003 TIDAK listening di 0.0.0.0:
ss -tlnp | grep 3003
# Output aman harus: 127.0.0.1:3003 (bukan 0.0.0.0:3003 atau *:3003)`;

  const nginxStealthSnippet = `# /etc/nginx/sites-available/mikrotik-backup.conf
# Blok 1: Tolak diam-diam (return 444) semua scan Shodan/Censys yang menembak IP VPS langsung!
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
    return 444;
}

# Blok 2: Hanya izinkan akses via domain HTTPS resmi + Reverse Proxy ke 127.0.0.1:3003
server {
    listen 443 ssl http2;
    server_name backup.domainanda.com;
    server_tokens off;

    ssl_certificate /etc/letsencrypt/live/backup.domainanda.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/backup.domainanda.com/privkey.pem;

    # Opsional: Whitelist IP kantor/VPN saja
    # allow 192.168.1.0/24;
    # deny all;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Keamanan Aplikasi &amp; Proteksi Anti-Shodan
              </h3>
              <p className="text-xs text-slate-500">
                Sembunyikan port aplikasi dari scanner publik (Shodan, Censys, ZoomEye, Masscan)
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

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Tabs */}
          <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('controls')}
              className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'controls' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Proteksi Aplikasi &amp; IP Allowlist</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hardening')}
              className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'hardening' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Anti-Shodan Port &amp; Server Guide</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'controls' && (
            loading ? (
              <div className="py-10 flex items-center justify-center text-xs text-slate-500 space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Memuat konfigurasi keamanan...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Protection Banner */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-bold flex items-center space-x-1.5">
                      <EyeOff className="w-4 h-4 text-emerald-600" />
                      <span>Docker Default Binding: 127.0.0.1:3003 (Localhost Only)</span>
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      Konfigurasi <code className="font-mono bg-white px-1 rounded border border-emerald-200">docker-compose.yml</code> kini mengikat port hanya ke <code className="font-mono font-semibold">127.0.0.1</code>, menghapus header <code className="font-mono">X-Powered-By</code> &amp; <code className="font-mono">ETag</code>, serta mengunci <code className="font-mono">/api/info</code> &amp; <code className="font-mono">/healthz</code> agar tidak terindeks Shodan.
                    </p>
                  </div>
                </div>

                {/* Toggle Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.blockScanners}
                      onChange={e => setSettings(prev => ({ ...prev, blockScanners: e.target.checked }))}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Blokir Scanner Publik (Anti-Shodan)</p>
                      <p className="text-slate-500 mt-0.5 leading-snug">
                        Otomatis memblokir probe Shodan, Censys, ZoomEye, Masscan, Nmap, serta scan path <code className="font-mono">/.env</code>, <code className="font-mono">/.git</code>, dll.
                      </p>
                    </div>
                  </label>

                  <label className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.silentDropUnauthorized}
                      onChange={e => setSettings(prev => ({ ...prev, silentDropUnauthorized: e.target.checked }))}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Mode Siluman (Silent TCP Drop)</p>
                      <p className="text-slate-500 mt-0.5 leading-snug">
                        Putus koneksi diam-diam tanpa mengirim banner HTTP/HTML saat IP atau scanner ilegal terdeteksi.
                      </p>
                    </div>
                  </label>
                </div>

                {/* IP Allowlist Section */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.ipAllowlistEnabled}
                        onChange={e => setSettings(prev => ({ ...prev, ipAllowlistEnabled: e.target.checked }))}
                        className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-900">
                        Aktifkan IP Allowlist (Hanya IP / Subnet Tertentu yang Boleh Akses)
                      </span>
                    </label>

                    {runtime?.clientIp && (
                      <button
                        type="button"
                        onClick={() => handleAddIp(runtime.clientIp)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition-colors"
                      >
                        + Tambah IP Saya ({runtime.clientIp})
                      </button>
                    )}
                  </div>

                  {runtime && runtime.envAllowedIps.length > 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                      <strong>Env Override Aktif:</strong> Variabel <code className="font-mono">ALLOWED_IPS</code> disetel di server ({runtime.envAllowedIps.join(', ')}).
                    </div>
                  )}

                  {/* Add IP Input */}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newIpInput}
                      onChange={e => setNewIpInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddIp();
                        }
                      }}
                      placeholder="Contoh: 192.168.1.0/24 atau 203.0.113.10"
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddIp()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>

                  {/* Quick CIDR Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-medium">Preset Cepat:</span>
                    {[
                      { label: 'LAN 192.168.x.x', val: '192.168.0.0/16' },
                      { label: 'Private 10.x.x.x', val: '10.0.0.0/8' },
                      { label: 'Docker/LAN 172.16/12', val: '172.16.0.0/12' },
                      { label: 'Tailscale VPN', val: '100.64.0.0/10' }
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => handleAddIp(p.val)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-medium cursor-pointer"
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Current Allowlist Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {settings.allowedIps.map(ip => (
                      <span
                        key={ip}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                      >
                        <span>{ip}</span>
                        {ip !== '127.0.0.1' && ip !== '::1' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIp(ip)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Hapus dari allowlist"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  <label className="flex items-center space-x-2 text-xs text-slate-700 pt-1 border-t border-slate-200/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.allowRegisteredDeviceIps}
                      onChange={e => setSettings(prev => ({ ...prev, allowRegisteredDeviceIps: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Otomatis izinkan IP Router MikroTik terdaftar saat mengirim Webhook Push backup</span>
                  </label>
                </div>

                {/* Rate Limit */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">Batas Permintaan API (Rate Limit per IP)</p>
                    <p className="text-slate-500">Mencegah brute-force dan pemindaian otomatis terhadap endpoint API.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={20}
                      max={1000}
                      value={settings.rateLimitPerMinute}
                      onChange={e => setSettings(prev => ({ ...prev, rateLimitPerMinute: Number(e.target.value) || 120 }))}
                      className="w-24 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <span className="text-slate-600 font-medium">req / menit</span>
                  </div>
                </div>
              </div>
            )
          )}

          {activeTab === 'hardening' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 space-y-1">
                <p className="font-bold flex items-center space-x-1.5">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Mengapa Port Muncul di Shodan &amp; Cara Mencegahnya 100%</span>
                </p>
                <p className="text-slate-700 leading-relaxed">
                  Docker secara default mem-bypass firewall UFW jika port di-publish sebagai <code className="font-mono">3003:3000</code> (sama dengan <code className="font-mono">0.0.0.0:3003</code>). Sekarang <code className="font-mono">docker-compose.yml</code> sudah diperbaiki menjadi <code className="font-mono font-bold">127.0.0.1:3003:3000</code> sehingga port tidak bisa dipindai dari internet. Pilih salah satu metode akses aman berikut:
                </p>
              </div>

              {/* Method 1: Cloudflare Tunnel */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Cloudflare Tunnel (Rekomendasi — 0 Port Terbuka di VPS)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(cloudflareSnippet, 'cf')}
                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedKey === 'cf' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cf' ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  <code>{cloudflareSnippet}</code>
                </pre>
              </div>

              {/* Method 2: SSH Tunnel / Tailscale */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">2. SSH Tunnel atau Tailscale / WireGuard VPN (Privat)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(sshTailscaleSnippet, 'ssh')}
                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedKey === 'ssh' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'ssh' ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  <code>{sshTailscaleSnippet}</code>
                </pre>
              </div>

              {/* Method 3: Nginx Stealth */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">3. Nginx Reverse Proxy Stealth (Drop IP Scan dengan 444)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(nginxStealthSnippet, 'nginx')}
                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedKey === 'nginx' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'nginx' ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  <code>{nginxStealthSnippet}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            IP Anda terdeteksi: <strong className="font-mono text-slate-800">{runtime?.clientIp || '-'}</strong>
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold cursor-pointer"
            >
              Tutup
            </button>
            {activeTab === 'controls' && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center space-x-1.5 shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Simpan Keamanan</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
