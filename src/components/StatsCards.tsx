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
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Router Terdaftar
          </span>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <Server className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.totalDevices}
          </span>
          <span className="text-xs text-emerald-600 font-semibold flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1"></span>
            {stats.activeDevices} aktif
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          MikroTik RouterOS terhubung
        </p>
      </div>

      {/* 2. Total Backups */}
      <div
        onClick={onViewBackups}
        className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all hover:bg-slate-50/50"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Konfigurasi
          </span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Database className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.totalBackups}
          </span>
          <span className="text-xs text-slate-500 font-medium">file tersimpan</span>
        </div>
        <p className="mt-1 text-xs text-indigo-600 font-medium flex items-center space-x-1">
          <span>Siap diunduh &amp; dibandingkan</span>
          <span>&rarr;</span>
        </p>
      </div>

      {/* 3. Storage Used */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Penyimpanan Lokal
          </span>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {formatBytes(stats.totalSizeBytes)}
          </span>
          <span className="text-xs text-slate-500 font-medium">terpakai</span>
        </div>
        <p className="mt-1 text-xs text-slate-500 flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
          <span>Retensi otomatis aktif</span>
        </p>
      </div>

      {/* 4. Latest Backup */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Backup Terakhir
          </span>
          <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-100">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-lg sm:text-xl font-black text-slate-900 truncate">
            {formatTimeAgo(stats.latestBackupTime || undefined)}
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-600 font-semibold flex items-center space-x-1 truncate">
          <CheckCircle2 className="w-3.5 h-3.5 inline shrink-0 text-emerald-500" />
          <span className="truncate">Otomatisasi berjalan lancar</span>
        </p>
      </div>
    </div>
  );
};
