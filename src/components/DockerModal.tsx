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
  const [activeTab, setActiveTab] = useState<'compose' | 'quick' | 'cli' | 'github'>('compose');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const composeContent = `services:
  mikrotik-backup:
    build: .
    image: mikrotik-backup-manager:latest
    container_name: mikrotik-backup-app
    restart: unless-stopped
    ports:
      - "3003:3000"
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

# 3. Jalankan container pada port 3003
docker run -d \\
  --name mikrotik-backup-app \\
  --restart unless-stopped \\
  -p 3003:3000 \\
  -v $(pwd)/data:/app/data \\
  mikrotik-backup-manager`;

  const gitPushScript = `# 1. Inisialisasi Git di komputer lokal Anda
git init
git add .
git commit -m "feat: initial commit mikrotik auto backup manager"
git branch -M main

# 2. Hubungkan ke Repository GitHub Anda (ganti URL sesuai repo Anda)
git remote add origin https://github.com/USERNAME/NAMA_REPO.git
git push -u origin main`;

  const gitInstallScript = `# 1. Di server/VPS, clone repository Anda
git clone https://github.com/USERNAME/NAMA_REPO.git
cd NAMA_REPO

# 2. Jalankan instalasi otomatis
chmod +x install.sh
./install.sh`;

  const gitUpdateScript = `# Jalankan update otomatis di server Anda:
chmod +x update.sh
./update.sh

# Atau secara manual:
git pull
docker compose up -d --build`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Panduan Install & Menjalankan di Docker
              </h3>
              <p className="text-xs text-slate-500">
                Langkah-langkah menjalankan aplikasi MikroTik Backup siap pakai menggunakan container
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
          {/* Method Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap space-x-1 sm:space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('compose')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'compose' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Docker Compose
            </button>
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'quick' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Script Otomatis
            </button>
            <button
              onClick={() => setActiveTab('cli')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'cli' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. Docker CLI
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'github' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              4. Git & GitHub
            </button>
          </div>

          {activeTab === 'compose' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                <span>File <code className="text-blue-700 font-mono font-semibold">docker-compose.yml</code> telah disiapkan di root direktori:</span>
                <button
                  onClick={() => handleCopy('docker compose up -d --build', 'cmd-compose')}
                  className="text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  {copiedKey === 'cmd-compose' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedKey === 'cmd-compose' ? 'Tersalin!' : 'Salin Perintah'}</span>
                </button>
              </div>

              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 font-mono text-xs text-blue-950 font-semibold">
                $ docker compose up -d --build
              </div>

              <div className="relative">
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] font-mono text-slate-800 overflow-x-auto max-h-56 leading-relaxed selection:bg-blue-100 selection:text-blue-900">
                  <code>{composeContent}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'quick' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Script <code className="text-blue-700 font-mono font-semibold">install.sh</code> otomatis menginstall Docker (jika belum ada), membuat volume persistent, mem-build container, dan langsung menjalankannya:
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-900 flex items-center justify-between">
                <div>
                  <p className="font-semibold">$ chmod +x install.sh</p>
                  <p className="font-semibold">$ ./install.sh</p>
                </div>
                <button
                  onClick={() => handleCopy(quickScript, 'cmd-quick')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg flex items-center space-x-1 text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  {copiedKey === 'cmd-quick' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copiedKey === 'cmd-quick' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'cli' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Jika Anda ingin menjalankan Docker secara manual tanpa docker-compose:
              </p>
              <div className="relative">
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-slate-800 overflow-x-auto max-h-48 leading-relaxed selection:bg-blue-100 selection:text-blue-900">
                  <code>{cliRunScript}</code>
                </pre>
                <button
                  onClick={() => handleCopy(cliRunScript, 'cmd-cli')}
                  className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg flex items-center space-x-1 text-[11px] font-semibold cursor-pointer shadow-2xs"
                >
                  {copiedKey === 'cmd-cli' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copiedKey === 'cmd-cli' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between text-slate-800 mb-1 font-bold">
                  <span>A. Cara Push File ke Repository GitHub:</span>
                  <button
                    onClick={() => handleCopy(gitPushScript, 'cmd-push')}
                    className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-semibold text-[11px] cursor-pointer"
                  >
                    {copiedKey === 'cmd-push' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span>{copiedKey === 'cmd-push' ? 'Tersalin' : 'Salin Script Push'}</span>
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-slate-800 overflow-x-auto max-h-40 leading-relaxed selection:bg-blue-100 selection:text-blue-900">
                    <code>{gitPushScript}</code>
                  </pre>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-800 mb-1 font-bold">
                  <span>B. Cara Install di Server Baru dari GitHub:</span>
                  <button
                    onClick={() => handleCopy(gitInstallScript, 'cmd-install')}
                    className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-semibold text-[11px] cursor-pointer"
                  >
                    {copiedKey === 'cmd-install' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span>{copiedKey === 'cmd-install' ? 'Tersalin' : 'Salin Script Install'}</span>
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-slate-800 overflow-x-auto max-h-40 leading-relaxed selection:bg-blue-100 selection:text-blue-900">
                    <code>{gitInstallScript}</code>
                  </pre>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-800 mb-1 font-bold">
                  <span>C. Cara Update Source Code (Aplikasi di Server):</span>
                  <button
                    onClick={() => handleCopy(gitUpdateScript, 'cmd-update')}
                    className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-semibold text-[11px] cursor-pointer"
                  >
                    {copiedKey === 'cmd-update' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span>{copiedKey === 'cmd-update' ? 'Tersalin' : 'Salin Script Update'}</span>
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-slate-800 overflow-x-auto max-h-40 leading-relaxed selection:bg-blue-100 selection:text-blue-900">
                    <code>{gitUpdateScript}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Volume Persistent notice */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start space-x-3">
            <HardDrive className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-950 font-bold">Penyimpanan Aman & Permanen (Volume Host):</strong>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                Semua file backup dan data router tersimpan di folder <code className="text-emerald-900 font-mono font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">./data</code> pada komputer/server Anda. Jika container di-restart, di-rebuild, atau di-update, data konfigurasi tetap utuh dan aman.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Port Host: 3003 (3003:3000) &bull; Base Image: node:20-alpine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
