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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Nonaktif
        </span>
      );
    }
    if (device.lastBackupStatus === 'success') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
          Aktif &amp; Normal
        </span>
      );
    }
    if (device.lastBackupStatus === 'failed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
          Gagal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3 mr-1 text-amber-600" />
        Menunggu Backup
      </span>
    );
  };

  const getProtocolBadge = () => {
    if (device.osVersion === 'v6' || device.protocol === 'api_binary') {
      const isCustom = device.port && device.port !== 8728 && device.port !== 8729;
      return (
        <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded">
          RouterOS v6 API {isCustom ? `(Custom Port: ${device.port})` : `(Port ${device.port || 8728})`}
        </span>
      );
    }
    if (device.protocol === 'push_webhook') {
      return (
        <span className="px-2 py-0.5 text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 rounded">
          Webhook Push (Fetch)
        </span>
      );
    }
    const isCustomV7 = device.port && device.port !== 443 && device.port !== 80;
    return (
      <span className="px-2 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 rounded">
        REST API v7 {isCustomV7 ? `(Custom Port: ${device.port})` : `(Port ${device.port || 443})`}
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between relative group">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base tracking-tight flex items-center space-x-2">
                <span>{device.name}</span>
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {device.ipHost}:{device.port}
              </p>
            </div>
          </div>

          {/* Action Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-20 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(device);
                    }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ubah Pengaturan</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onViewScript(device);
                    }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Skrip RouterOS</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onViewBackups(device);
                    }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Lihat Backup ({device.backupCount})</span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(device);
                    }}
                    className="w-full text-left px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer"
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

        <div className="mt-3 text-xs text-slate-600">
          <span className="text-slate-400">Model:</span> {device.model || 'MikroTik RouterOS'}
        </div>

        {/* Schedule & Retention Specs */}
        <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-700">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Jadwal Otomatis:</span>
            </span>
            <span className="font-semibold text-slate-800">
              {getFrequencyLabel(device.scheduleFrequency, device.scheduleTime)}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Batas Retensi:</span>
            </span>
            <span className="font-semibold text-slate-800">
              Maks {device.retentionCount} file
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tersimpan:</span>
            </span>
            <span className="font-semibold text-slate-800">
              {device.backupCount} file ({formatBytes(device.totalStorageBytes)})
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5 text-cyan-600" />
              <span>Terakhir Backup:</span>
            </span>
            <span className="font-semibold text-slate-800">
              {formatTimeAgo(device.lastBackupAt)}
            </span>
          </div>
        </div>

        {device.lastBackupMessage && (
          <p className="mt-2 text-[11px] text-slate-500 truncate" title={device.lastBackupMessage}>
            &bull; {device.lastBackupMessage}
          </p>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
        <button
          onClick={() => onViewScript(device)}
          className="flex-1 inline-flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition-colors cursor-pointer"
          title="Dapatkan script terminal MikroTik RouterOS"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-700" />
          <span>Skrip RouterOS</span>
        </button>

        <button
          onClick={() => onBackupNow(device)}
          disabled={isTriggering}
          className="flex-1 inline-flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          title="Jalankan backup langsung sekarang"
        >
          <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
          <span>{isTriggering ? 'Memproses...' : 'Backup Sekarang'}</span>
        </button>
      </div>
    </div>
  );
};
