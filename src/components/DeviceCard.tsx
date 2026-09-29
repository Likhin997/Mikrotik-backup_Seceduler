import React from 'react';
import {
  Server,
  Terminal,
  Play,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Clock,
  Edit2,
  Trash2,
  FileCode,
  HardDrive
} from 'lucide-react';
import { RouterDevice } from '../types';
import { formatBytes, formatTimeAgo, getFrequencyLabel } from '../utils/formatters';

interface DeviceCardProps {
  device: RouterDevice;
  onBackupNow: (device: RouterDevice) => void;
  onViewScript: (device: RouterDevice) => void;
  onEdit: (device: RouterDevice) => void;
  onDelete: (device: RouterDevice) => void;
  onViewBackups: (device: RouterDevice) => void;
  isTriggering?: boolean;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onBackupNow,
  onViewScript,
  onEdit,
  onDelete,
  onViewBackups,
  isTriggering = false
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const getStatusBadge = () => {
    if (!device.enabled) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          Nonaktif
        </span>
      );
    }
    if (device.lastBackupStatus === 'success') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Aktif & Normal
        </span>
      );
    }
    if (device.lastBackupStatus === 'failed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Gagal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3 mr-1" />
        Menunggu Backup
      </span>
    );
  };

  const getProtocolBadge = () => {
    if (device.protocol === 'push_webhook') {
      return (
        <span className="px-2 py-0.5 text-[11px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded">
          Webhook Push (RouterOS Fetch)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded">
        REST API v7 (Pull)
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between relative group">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base tracking-tight flex items-center space-x-2">
                <span>{device.name}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {device.ipHost}:{device.port}
              </p>
            </div>
          </div>

          {/* Action Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-20 text-sm">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(device);
                    }}
                    className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center space-x-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Ubah Pengaturan</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onViewScript(device);
                    }}
                    className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center space-x-2"
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Skrip RouterOS</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onViewBackups(device);
                    }}
                    className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center space-x-2"
                  >
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>Lihat Backup ({device.backupCount})</span>
                  </button>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(device);
                    }}
                    className="w-full text-left px-3 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center space-x-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Router</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Device Badges & Info */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {getStatusBadge()}
          {getProtocolBadge()}
        </div>

        <div className="mt-3 text-xs text-slate-400">
          <span className="text-slate-500">Model:</span> {device.model || 'MikroTik RouterOS'}
        </div>

        {/* Schedule & Retention Specs */}
        <div className="mt-4 bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Jadwal Otomatis:</span>
            </span>
            <span className="font-medium text-slate-200">
              {getFrequencyLabel(device.scheduleFrequency, device.scheduleTime)}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Batas Retensi:</span>
            </span>
            <span className="font-medium text-slate-200">
              Maks {device.retentionCount} file
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tersimpan:</span>
            </span>
            <span className="font-medium text-slate-200">
              {device.backupCount} file ({formatBytes(device.totalStorageBytes)})
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/60">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Terakhir Backup:</span>
            </span>
            <span className="font-medium text-slate-200">
              {formatTimeAgo(device.lastBackupAt)}
            </span>
          </div>
        </div>

        {device.lastBackupMessage && (
          <p className="mt-2 text-[11px] text-slate-400 truncate" title={device.lastBackupMessage}>
            &bull; {device.lastBackupMessage}
          </p>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={() => onViewScript(device)}
          className="flex-1 inline-flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/50 transition-colors"
          title="Dapatkan script terminal MikroTik RouterOS"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Skrip RouterOS</span>
        </button>

        <button
          onClick={() => onBackupNow(device)}
          disabled={isTriggering}
          className="flex-1 inline-flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          title="Jalankan backup langsung sekarang"
        >
          <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
          <span>{isTriggering ? 'Memproses...' : 'Backup Sekarang'}</span>
        </button>
      </div>
    </div>
  );
};
