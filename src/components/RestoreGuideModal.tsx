import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Terminal,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  FileCode
} from 'lucide-react';
import { JetCyberLogo } from './JetCyberLogo';

interface RestoreGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RestoreGuideModal: React.FC<RestoreGuideModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'rsc' | 'backup'>('rsc');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center space-x-3">
            <JetCyberLogo variant="icon" size={44} />
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Panduan Restore Konfigurasi MikroTik
              </h3>
              <p className="text-xs text-slate-500">
                JET CYBER NETWORK &bull; Prosedur pemulihan konfigurasi RouterOS (.rsc / .backup)
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
        <div className="p-6 space-y-6">
          {/* Format Selection Tab */}
          <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('rsc')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'rsc'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Restore File Teks .rsc (Direkomendasikan)</span>
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Restore File Binary .backup</span>
            </button>
          </div>

          {activeTab === 'rsc' ? (
            <div className="space-y-4">
              {/* Method 1: Import Full Script */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">1</span>
                    <span>Metode Import Penuh via WinBox Terminal</span>
                  </h4>
                  <button
                    onClick={() => copyText('/import file-name=nama_file.rsc verbose=yes', 'cmd1')}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedCmd === 'cmd1' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span>{copiedCmd === 'cmd1' ? 'Tersalin' : 'Salin Perintah'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Unggah file <code className="text-blue-700 font-mono font-semibold">.rsc</code> ke menu <strong>Files</strong> di WinBox, kemudian buka <strong>New Terminal</strong> dan jalankan:
                </p>
                <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 font-mono text-xs text-blue-950 font-semibold">
                  /import file-name=nama_file.rsc verbose=yes
                </div>
                <p className="text-[11px] text-slate-500">
                  Parameter <code className="text-slate-700 font-mono">verbose=yes</code> akan menampilkan baris mana saja yang berhasil atau terjadi konflik.
                </p>
              </div>

              {/* Method 2: Selective Paste */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">2</span>
                  <span>Metode Salin Sebagian (Selective Paste - Paling Aman)</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Jika Anda hanya ingin memulihkan bagian tertentu (contoh: hanya aturan <em>Firewall Filter</em> atau konfigurasi <em>IP Address / VLAN</em>):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
                  <li>Buka backup di tombol <strong>"Lihat Isi"</strong> pada tabel aplikasi ini.</li>
                  <li>Cari seksi yang diinginkan menggunakan fitur pencarian (misal: <code className="text-blue-700 font-mono font-semibold">/ip firewall filter</code>).</li>
                  <li>Salin baris yang diperlukan dan paste langsung ke New Terminal WinBox.</li>
                </ol>
              </div>

              {/* Safe Mode Tip */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-emerald-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-950 font-bold">Tips Keamanan Jaringan:</strong> Selalu aktifkan fitur <strong>Safe Mode</strong> (tekan tombol Safe Mode di pojok kiri atas WinBox atau shortcut <kbd className="bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 font-mono text-[11px] text-emerald-950 font-bold">Ctrl + X</kbd>) sebelum mengimpor konfigurasi baru. Jika koneksi terputus, RouterOS otomatis membatalkan perubahan sehingga router tidak terkunci!
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 text-xs">
                  Langkah-Langkah Restore File Binary (.backup):
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-600">
                  <li>Unduh file <code className="text-blue-700 font-mono font-semibold">.backup</code> dari aplikasi ke komputer Anda.</li>
                  <li>Buka WinBox dan masuk ke router MikroTik.</li>
                  <li>Buka menu <strong className="text-slate-900">Files</strong> di sebelah kiri.</li>
                  <li>Drag &amp; drop file <code className="text-blue-700 font-mono font-semibold">.backup</code> ke jendela Files WinBox.</li>
                  <li>Pilih file tersebut, lalu klik tombol <strong className="text-blue-700 font-bold">Restore</strong> di toolbar atas.</li>
                  <li>Jika file dienkripsi, masukkan password enkripsi backup.</li>
                  <li>Router akan meminta konfirmasi dan melakukan <strong>Reboot otomatis</strong> untuk memuat sistem penuh.</li>
                </ol>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-950 font-bold">Peringatan Keras Hardware:</strong> File <code className="text-amber-950 font-mono font-semibold">.backup</code> menyimpan salinan identik dari MAC Address interface fisik dan driver hardware. <strong>Hanya pulihkan ke tipe hardware router yang sama persis</strong> untuk menghindari tabrakan MAC address atau port ether yang tidak terdeteksi.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
