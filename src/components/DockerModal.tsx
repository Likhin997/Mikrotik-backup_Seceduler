import React, { useState } from 'react';
import {
  X,
  Box,
  Copy,
  Check,
  Terminal,
  FolderGit2,
  HardDrive,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface DockerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DockerModal: React.FC<DockerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'compose' | 'quick' | 'cli'>('compose');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const composeContent = `version: '3.8'

services:
  mikrotik-backup:
    build: .
    image: mikrotik-backup-manager:latest
    container_name: mikrotik-backup-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      # File konfigurasi tersimpan permanen di folder host ./data
      - ./data:/app/data`;

  const quickScript = `chmod +x install.sh
./install.sh`;

  const cliRunScript = `# 1. Build image Docker
docker build -t mikrotik-backup-manager .

# 2. Buat folder penyimpanan di host
mkdir -p $(pwd)/data/backups

# 3. Jalankan container
docker run -d \\
  --name mikrotik-backup-app \\
  --restart unless-stopped \\
  -p 3000:3000 \\
  -v $(pwd)/data:/app/data \\
  mikrotik-backup-manager`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                Panduan Install & Menjalankan di Docker
              </h3>
              <p className="text-xs text-slate-400">
                Langkah-langkah menjalankan aplikasi MikroTik Backup siap pakai menggunakan container
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
          {/* Method Tabs */}
          <div className="flex space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('compose')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all ${
                activeTab === 'compose' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Docker Compose (Rekomendasi)
            </button>
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all ${
                activeTab === 'quick' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Script Otomatis (install.sh)
            </button>
            <button
              onClick={() => setActiveTab('cli')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all ${
                activeTab === 'cli' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Docker CLI Manual
            </button>
          </div>

          {activeTab === 'compose' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>File <code>docker-compose.yml</code> telah disiapkan di root direktori:</span>
                <button
                  onClick={() => handleCopy('docker compose up -d --build', 'cmd-compose')}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                >
                  {copiedKey === 'cmd-compose' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cmd-compose' ? 'Tersalin!' : 'Salin Perintah'}</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-cyan-300">
                $ docker compose up -d --build
              </div>

              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                  <code>{composeContent}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'quick' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Script <code>install.sh</code> otomatis menginstall Docker (jika belum ada), membuat volume persistent, mem-build container, dan langsung menjalankannya:
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-cyan-300 flex items-center justify-between">
                <div>
                  <p>$ chmod +x install.sh</p>
                  <p>$ ./install.sh</p>
                </div>
                <button
                  onClick={() => handleCopy(quickScript, 'cmd-quick')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center space-x-1 text-xs"
                >
                  {copiedKey === 'cmd-quick' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'cmd-quick' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'cli' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Jika Anda ingin menjalankan Docker secara manual tanpa docker-compose:
              </p>
              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-48 leading-relaxed">
                  <code>{cliRunScript}</code>
                </pre>
                <button
                  onClick={() => handleCopy(cliRunScript, 'cmd-cli')}
                  className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center space-x-1 text-[11px]"
                >
                  {copiedKey === 'cmd-cli' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'cmd-cli' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Volume Persistent notice */}
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-start space-x-3">
            <HardDrive className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Penyimpanan Aman & Permanen (Volume Host):</strong>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Semua file backup dan data router tersimpan di folder <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded">./data</code> pada komputer/server Anda. Jika container di-restart, di-rebuild, atau di-update, data konfigurasi tetap utuh dan aman.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500">Port Default: 3000 &bull; Base Image: node:20-alpine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
