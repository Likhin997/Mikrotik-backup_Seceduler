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
  const [activeTab, setActiveTab] = useState<'rsc' | 'binary'>('rsc');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (device && isOpen) {
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

  const currentCode = activeTab === 'rsc'
    ? scriptData?.scriptContentRsc || ''
    : scriptData?.scriptContentBinary || '';

  const handleCopy = () => {
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                Skrip Otomatisasi RouterOS: {device.name}
              </h3>
              <p className="text-xs text-slate-400">
                Salin dan tempel (paste) skrip ini ke Terminal WinBox / WebFig / SSH
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Format selection tabs */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('rsc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'rsc'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Text Export (.rsc) - Direkomendasikan
              </button>
              <button
                onClick={() => setActiveTab('binary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'binary'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Binary System Backup (.backup)
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-sm active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Seluruh Skrip</span>
                </>
              )}
            </button>
          </div>

          {/* Explanation badge */}
          {activeTab === 'rsc' ? (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Keunggulan .rsc (Text Export):</span> Format konfigurasi teks terbuka yang dapat dibaca manusia, dapat dibandingkan perubahannya (Diff), diedit sebagian, dan direstore pada tipe router MikroTik yang berbeda.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Tentang .backup (Binary):</span> Menyimpan seluruh status sistem, sertifikat TLS, dan password terenkripsi. Direkomendasikan hanya direstore pada tipe perangkat keras yang identik.
              </div>
            </div>
          )}

          {/* Script Code Box */}
          <div className="relative">
            {loading ? (
              <div className="h-64 flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-400" />
                Menyiapkan skrip RouterOS...
              </div>
            ) : error ? (
              <div className="h-64 flex items-center justify-center bg-slate-950 rounded-xl border border-rose-800/40 text-rose-400 text-xs p-4">
                {error}
              </div>
            ) : (
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-300 overflow-x-auto max-h-72 leading-relaxed selection:bg-cyan-900 selection:text-white">
                <code>{currentCode}</code>
              </pre>
            )}
          </div>

          {/* Step-by-step paste instruction */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
            <h4 className="font-semibold text-white text-xs flex items-center space-x-1.5">
              <span>Langkah Pemasangan di MikroTik WinBox:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>Buka aplikasi <span className="text-white font-medium">WinBox</span> dan login ke router Anda ({device.ipHost}).</li>
              <li>Klik menu <span className="text-cyan-300 font-mono">New Terminal</span> di menu sebelah kiri.</li>
              <li>Klik kanan pada area hitam terminal dan pilih <span className="text-white font-medium">Paste</span>.</li>
              <li>Tekan <span className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">Enter</span>. Router akan langsung membuat script otomatis, menjadwalkan di <span className="text-cyan-300 font-mono">/system scheduler</span>, dan mengunggah backup pertama kali!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Jadwal: {device.scheduleFrequency} &bull; Webhook Token aktif
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
