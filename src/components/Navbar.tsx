import React from 'react';
import {
  Server,
  HardDrive,
  Clock,
  Plus,
  Upload,
  RefreshCw,
  HelpCircle,
  Activity,
  FileCode,
  Box
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'devices' | 'backups' | 'logs' | 'guide';
  setActiveTab: (tab: 'devices' | 'backups' | 'logs' | 'guide') => void;
  onOpenAddDevice: () => void;
  onOpenUpload: () => void;
  onOpenDocker: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalBackups: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddDevice,
  onOpenUpload,
  onOpenDocker,
  onRefresh,
  isRefreshing,
  totalBackups
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">MikroTik</span>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                  Auto Backup
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Penyimpanan Otomatis Konfigurasi RouterOS (.rsc & .backup)
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'devices'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Router & Jadwal</span>
            </button>
            <button
              onClick={() => setActiveTab('backups')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'backups'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Riwayat Backup</span>
              {totalBackups > 0 && (
                <span className="px-1.5 py-0.2 bg-slate-800 text-blue-400 text-xs rounded-full border border-blue-500/20">
                  {totalBackups}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'logs'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Aktivitas</span>
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'guide'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Cara Restore</span>
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Perbarui data"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              onClick={onOpenDocker}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 rounded-lg transition-colors shadow-xs"
              title="Panduan Docker & Compose"
            >
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Docker Run</span>
            </button>

            <button
              onClick={onOpenUpload}
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah File</span>
            </button>

            <button
              onClick={onOpenAddDevice}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Router</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-slate-800 py-2 justify-around">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeTab === 'devices' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400'
            }`}
          >
            Router
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeTab === 'backups' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400'
            }`}
          >
            Backup ({totalBackups})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeTab === 'logs' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400'
            }`}
          >
            Log
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeTab === 'guide' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400'
            }`}
          >
            Panduan
          </button>
          <button
            onClick={onOpenUpload}
            className="px-2 py-1 text-xs font-medium text-slate-300"
          >
            Unggah
          </button>
        </div>
      </div>
    </header>
  );
};
