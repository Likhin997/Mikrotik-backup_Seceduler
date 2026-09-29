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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                Panduan Restore Konfigurasi MikroTik
              </h3>
              <p className="text-xs text-slate-400">
                Cara mengembalikan konfigurasi RouterOS menggunakan file yang telah diunduh
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
        <div className="p-6 space-y-6">
          {/* Format Selection Tab */}
          <div className="flex space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('rsc')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'rsc'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Restore File Teks .rsc (Direkomendasikan)</span>
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'backup'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Restore File Binary .backup</span>
            </button>
          </div>

          {activeTab === 'rsc' ? (
            <div className="space-y-4">
              {/* Method 1: Import Full Script */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white text-xs flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">1</span>
                    <span>Metode Import Penuh via WinBox Terminal</span>
                  </h4>
                  <button
                    onClick={() => copyText('/import file-name=nama_file.rsc verbose=yes', 'cmd1')}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                  >
                    {copiedCmd === 'cmd1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCmd === 'cmd1' ? 'Tersalin' : 'Salin Perintah'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-300">
                  Unggah file <code className="text-cyan-300">.rsc</code> ke menu <strong>Files</strong> di WinBox, kemudian buka <strong>New Terminal</strong> dan jalankan:
                </p>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-cyan-300">
                  /import file-name=nama_file.rsc verbose=yes
                </div>
                <p className="text-[11px] text-slate-400">
                  Parameter <code className="text-slate-300 font-mono">verbose=yes</code> akan menampilkan baris mana saja yang berhasil atau terjadi konflik.
                </p>
              </div>

              {/* Method 2: Selective Paste */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white text-xs flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">2</span>
                  <span>Metode Salin Sebagian (Selective Paste - Paling Aman)</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Jika Anda hanya ingin memulihkan bagian tertentu (contoh: hanya aturan <em>Firewall Filter</em> atau konfigurasi <em>IP Address / VLAN</em>):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
                  <li>Buka backup di tombol <strong>"Lihat Isi"</strong> pada tabel aplikasi ini.</li>
                  <li>Cari seksi yang diinginkan menggunakan fitur pencarian (misal: <code className="text-cyan-300 font-mono">/ip firewall filter</code>).</li>
                  <li>Salin baris yang diperlukan dan paste langsung ke New Terminal WinBox.</li>
                </ol>
              </div>

              {/* Safe Mode Tip */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-emerald-300">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Tips Keamanan Jaringan:</strong> Selalu aktifkan fitur <strong>Safe Mode</strong> (tekan tombol Safe Mode di pojok kiri atas WinBox atau shortcut <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-700">Ctrl + X</kbd>) sebelum mengimpor konfigurasi baru. Jika koneksi terputus, RouterOS otomatis membatalkan perubahan sehingga router tidak terkunci!
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-3 text-xs">
                <h4 className="font-semibold text-white text-xs">
                  Langkah-Langkah Restore File Binary (.backup):
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-300">
                  <li>Unduh file <code className="text-cyan-300 font-mono">.backup</code> dari aplikasi ke komputer Anda.</li>
                  <li>Buka WinBox dan masuk ke router MikroTik.</li>
                  <li>Buka menu <strong className="text-white">Files</strong> di sebelah kiri.</li>
                  <li>Drag & drop file <code className="text-cyan-300 font-mono">.backup</code> ke jendela Files WinBox.</li>
                  <li>Pilih file tersebut, lalu klik tombol <strong className="text-blue-400">Restore</strong> di toolbar atas.</li>
                  <li>Jika file dienkripsi, masukkan password enkripsi backup.</li>
                  <li>Router akan meminta konfirmasi dan melakukan <strong>Reboot otomatis</strong> untuk memuat sistem penuh.</li>
                </ol>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-300">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Peringatan Keras Hardware:</strong> File <code className="text-white">.backup</code> menyimpan salinan identik dari MAC Address interface fisik dan driver hardware. <strong>Hanya pulihkan ke tipe hardware router yang sama persis</strong> untuk menghindari tabrakan MAC address atau port ether yang tidak terdeteksi.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
