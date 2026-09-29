import React from 'react';
import { Server, Database, HardDrive, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SystemStats } from '../types';
import { formatBytes, formatTimeAgo } from '../utils/formatters';

interface StatsCardsProps {
  stats: SystemStats | null;
  onViewBackups: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, onViewBackups }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total Routers */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Router Terdaftar
          </span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Server className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {stats.totalDevices}
          </span>
          <span className="text-xs text-emerald-400 font-medium flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1"></span>
            {stats.activeDevices} aktif
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          MikroTik RouterOS terhubung
        </p>
      </div>

      {/* 2. Total Backups */}
      <div
        onClick={onViewBackups}
        className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-sm relative overflow-hidden cursor-pointer transition-all hover:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Konfigurasi
          </span>
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Database className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {stats.totalBackups}
          </span>
          <span className="text-xs text-slate-400 font-medium">file tersimpan</span>
        </div>
        <p className="mt-1 text-xs text-indigo-300/80 flex items-center space-x-1">
          <span>Siap diunduh & dibandingkan</span>
          <span>&rarr;</span>
        </p>
      </div>

      {/* 3. Storage Used */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Penyimpanan Lokal
          </span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {formatBytes(stats.totalSizeBytes)}
          </span>
          <span className="text-xs text-slate-400 font-medium">terpakai</span>
        </div>
        <p className="mt-1 text-xs text-slate-400 flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
          <span>Retensi otomatis aktif</span>
        </p>
      </div>

      {/* 4. Latest Backup */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Backup Terakhir
          </span>
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-lg sm:text-xl font-bold text-white truncate">
            {formatTimeAgo(stats.latestBackupTime || undefined)}
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-400 flex items-center space-x-1 truncate">
          <CheckCircle2 className="w-3.5 h-3.5 inline shrink-0" />
          <span className="truncate">Otomatisasi berjalan lancar</span>
        </p>
      </div>
    </div>
  );
};
