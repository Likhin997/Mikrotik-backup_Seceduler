import React, { useState, useEffect } from 'react';
import { X, Terminal, Copy, Check, ShieldAlert, Info, Play, ExternalLink, RefreshCw } from 'lucide-react';
import { RouterDevice, ScriptResponse } from '../types';
import { api } from '../services/api';

interface ScriptGeneratorModalProps {
  device: RouterDevice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ScriptGeneratorModal: React.FC<ScriptGeneratorModalProps> = ({
  device,
  isOpen,
  onClose
}) => {
  const [scriptData, setScriptData] = useState<ScriptResponse | null>(null);
  const [osVersion, setOsVersion] = useState<'v7' | 'v6'>(device?.osVersion === 'v6' ? 'v6' : 'v7');
  const [activeTab, setActiveTab] = useState<'rsc' | 'binary' | 'service'>('rsc');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (device && isOpen) {
      if (device.osVersion) setOsVersion(device.osVersion);
      loadScript();
    }
  }, [device, isOpen]);

  const loadScript = async () => {
    if (!device) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDeviceScript(device.id);
      setScriptData(data);
    } catch (err: any) {
      setError(err.message || 'Gagal menghasilkan skrip RouterOS');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !device) return null;

  const targetPort = device.port || (osVersion === 'v6' ? 8728 : 443);
  const svc = (targetPort === 8729 || (device.useTls && targetPort !== 8728)) ? 'api-ssl' : 'api';
  const serviceCommand =
    osVersion === 'v6'
      ? `# =========================================================
# MikroTik RouterOS v6: Konfigurasi Service API (Port ${targetPort})
# Target Device: ${device.name} (${device.ipHost})
# Port: ${targetPort} ${targetPort !== 8728 && targetPort !== 8729 ? '(Port Custom)' : '(Default)'}
# =========================================================

# 1. Aktifkan service API pada port yang diinginkan
/ip service set ${svc} port=${targetPort} disabled=no

# 2. Verifikasi status service API di router
/ip service print where name="${svc}"
`
      : `# =========================================================
# MikroTik RouterOS v7: Konfigurasi Service REST API (Port ${targetPort})
# Target Device: ${device.name} (${device.ipHost})
# =========================================================

# 1. Aktifkan service WWW/SSL pada port yang diinginkan
/ip service set ${device.useTls || targetPort === 443 ? 'www-ssl' : 'www'} port=${targetPort} disabled=no

# 2. Verifikasi status service
/ip service print where name="${device.useTls || targetPort === 443 ? 'www-ssl' : 'www'}"
`;

  const currentCode =
    activeTab === 'service'
      ? serviceCommand
      : osVersion === 'v6'
      ? activeTab === 'rsc'
        ? scriptData?.scriptContentRscV6 || scriptData?.scriptContentRsc || ''
        : scriptData?.scriptContentBinaryV6 || scriptData?.scriptContentBinary || ''
      : activeTab === 'rsc'
      ? scriptData?.scriptContentRsc || ''
      : scriptData?.scriptContentBinary || '';

  const handleCopy = () => {
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Skrip Otomatisasi RouterOS: {device.name}
              </h3>
              <p className="text-xs text-slate-500">
                Salin dan tempel (paste) skrip ini ke Terminal WinBox / WebFig / SSH
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* OS Version Selector */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Pilih Versi MikroTik RouterOS:</span>
              <span className="text-[11px] text-slate-500">Sintaks perintah ekspor dan upload disesuaikan otomatis</span>
            </div>
            <div className="flex space-x-1.5 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setOsVersion('v7')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  osVersion === 'v7'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                RouterOS v7
              </button>
              <button
                type="button"
                onClick={() => setOsVersion('v6')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  osVersion === 'v6'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                RouterOS v6 (CCR / RB Series)
              </button>
            </div>
          </div>

          {/* Format selection tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('rsc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'rsc'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Text Export (.rsc)
              </button>
              <button
                onClick={() => setActiveTab('binary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'binary'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Binary Backup (.backup)
              </button>
              <button
                onClick={() => setActiveTab('service')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'service'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Aktifkan Service API (Port {targetPort})
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs cursor-pointer active:scale-95 self-start sm:self-auto"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Perintah</span>
                </>
              )}
            </button>
          </div>

          {/* Explanation badge */}
          {activeTab === 'service' ? (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-indigo-950">Aktivasi Port API ({targetPort}):</span> Perintah untuk mengaktifkan port API pada router MikroTik Anda di menu <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">/ip service</code> agar server ini dapat menarik data konfigurasi secara otomatis pada jadwal yang ditentukan.
              </div>
            </div>
          ) : activeTab === 'rsc' ? (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-blue-950">Keunggulan .rsc (Text Export):</span> Format konfigurasi teks terbuka yang dapat dibaca manusia, dapat dibandingkan perubahannya (Diff), diedit sebagian, dan direstore pada tipe router MikroTik yang berbeda.
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950">Tentang .backup (Binary):</span> Menyimpan seluruh status sistem, sertifikat TLS, dan password terenkripsi. Direkomendasikan hanya direstore pada tipe perangkat keras yang identik.
              </div>
            </div>
          )}

          {/* Script Code Box */}
          <div className="relative">
            {loading ? (
              <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
                Menyiapkan skrip RouterOS...
              </div>
            ) : error ? (
              <div className="h-64 flex items-center justify-center bg-rose-50 rounded-xl border border-rose-200 text-rose-700 text-xs p-4">
                {error}
              </div>
            ) : (
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-800 overflow-x-auto max-h-72 leading-relaxed selection:bg-blue-100 selection:text-blue-900">
                <code>{currentCode}</code>
              </pre>
            )}
          </div>

          {/* Step-by-step paste instruction */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
              <span>Langkah Pemasangan di MikroTik WinBox:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
              <li>Buka aplikasi <span className="text-slate-900 font-semibold">WinBox</span> dan login ke router Anda ({device.ipHost}).</li>
              <li>Klik menu <span className="text-blue-700 font-mono font-semibold">New Terminal</span> di menu sebelah kiri.</li>
              <li>Klik kanan pada area terminal dan pilih <span className="text-slate-900 font-semibold">Paste</span>.</li>
              <li>Tekan <span className="text-slate-900 font-mono bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">Enter</span>. Router akan langsung membuat script otomatis, menjadwalkan di <span className="text-blue-700 font-mono font-semibold">/system scheduler</span>, dan mengunggah backup pertama kali!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Jadwal: {device.scheduleFrequency} &bull; Webhook Token aktif
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
