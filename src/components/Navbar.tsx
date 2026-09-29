import React, { useState } from 'react';
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
  Box,
  User,
  KeyRound,
  LogOut,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import { AuthUser } from '../types';
import { JetCyberLogo } from './JetCyberLogo';

interface NavbarProps {
  activeTab: 'devices' | 'backups' | 'logs' | 'guide';
  setActiveTab: (tab: 'devices' | 'backups' | 'logs' | 'guide') => void;
  onOpenAddDevice: () => void;
  onOpenUpload: () => void;
  onOpenDocker: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalBackups: number;
  currentUser?: AuthUser | null;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddDevice,
  onOpenUpload,
  onOpenDocker,
  onRefresh,
  isRefreshing,
  totalBackups,
  currentUser,
  onOpenChangePassword = () => {},
  onLogout = () => {}
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Brand: Heroic logo emblem with compact, sleek typography */}
          <button
            onClick={() => setActiveTab('devices')}
            className="flex items-center text-left hover:opacity-95 transition-opacity cursor-pointer group py-1"
          >
            <JetCyberLogo variant="horizontal" size={62} theme="light" />
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'devices'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Router &amp; Jadwal</span>
            </button>
            <button
              onClick={() => setActiveTab('backups')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'backups'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Riwayat Backup</span>
              {totalBackups > 0 && (
                <span className={`px-1.5 py-0.2 text-xs rounded-full font-bold ${
                  activeTab === 'backups' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {totalBackups}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Aktivitas</span>
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
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
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <button
              onClick={onOpenDocker}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100/80 border border-cyan-200 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Panduan Docker & Compose"
            >
              <Box className="w-3.5 h-3.5 text-cyan-600" />
              <span className="hidden sm:inline">Docker Run</span>
            </button>

            <button
              onClick={onOpenUpload}
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Unggah File</span>
            </button>

            <button
              onClick={onOpenAddDevice}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah Router</span>
              <span className="sm:hidden">Tambah</span>
            </button>

            {/* User Profile & Logout Dropdown */}
            {currentUser && (
              <div className="relative ml-1">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-xs cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 font-bold text-[11px]">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-800 hidden sm:inline">{currentUser.username}</span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/60 rounded-t-xl">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <p className="font-bold text-slate-900">{currentUser.username}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>Auto-Logout 30 Menit Idle</span>
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenChangePassword();
                        }}
                        className="w-full text-left px-3.5 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ganti Password</span>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar / Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-slate-200 py-2 justify-around bg-white">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
              activeTab === 'devices' ? 'text-blue-700 bg-blue-50' : 'text-slate-600'
            }`}
          >
            Router
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
              activeTab === 'backups' ? 'text-blue-700 bg-blue-50' : 'text-slate-600'
            }`}
          >
            Backup ({totalBackups})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
              activeTab === 'logs' ? 'text-blue-700 bg-blue-50' : 'text-slate-600'
            }`}
          >
            Log
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
              activeTab === 'guide' ? 'text-blue-700 bg-blue-50' : 'text-slate-600'
            }`}
          >
            Panduan
          </button>
          <button
            onClick={onOpenUpload}
            className="px-2 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Unggah
          </button>
        </div>
      </div>
    </header>
  );
};
