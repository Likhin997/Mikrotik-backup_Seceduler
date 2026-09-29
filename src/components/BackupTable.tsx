import React, { useState } from 'react';
import {
  FileCode,
  HardDrive,
  Download,
  Eye,
  Layers,
  Trash2,
  Search,
  Filter,
  Calendar,
  Clock,
  Server,
  CheckCircle2,
  FileCheck,
  Tag
} from 'lucide-react';
import { BackupRecord, RouterDevice } from '../types';
import { formatBytes, formatDate, formatTimeAgo } from '../utils/formatters';
import { api } from '../services/api';

interface BackupTableProps {
  backups: BackupRecord[];
  devices: RouterDevice[];
  selectedDeviceFilter: string;
  setSelectedDeviceFilter: (id: string) => void;
  onViewContent: (backup: BackupRecord) => void;
  onCompare: (backup: BackupRecord) => void;
  onDelete: (backup: BackupRecord) => void;
  onOpenUpload: () => void;
}

export const BackupTable: React.FC<BackupTableProps> = ({
  backups,
  devices,
  selectedDeviceFilter,
  setSelectedDeviceFilter,
  onViewContent,
  onCompare,
  onDelete,
  onOpenUpload
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'rsc' | 'backup'>('all');

  const filtered = backups.filter(b => {
    if (selectedDeviceFilter && selectedDeviceFilter !== 'all' && b.deviceId !== selectedDeviceFilter) {
      return false;
    }
    if (typeFilter !== 'all' && b.fileType !== typeFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        b.filename.toLowerCase().includes(q) ||
        b.deviceName.toLowerCase().includes(q) ||
        b.deviceIp.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const totalFilteredSize = filtered.reduce((acc, b) => acc + b.fileSize, 0);

  const getTriggerBadge = (trigger: string) => {
    switch (trigger) {
      case 'scheduled':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Jadwal Otomatis
          </span>
        );
      case 'webhook_push':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
            Push RouterOS
          </span>
        );
      case 'rest_api':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            REST API Pull
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Manual
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Table Filter Bar */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama file, router, IP, atau catatan..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>

        {/* Device Dropdown Filter */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedDeviceFilter}
            onChange={e => setSelectedDeviceFilter(e.target.value)}
            className="bg-white border border-slate-300 text-xs text-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
          >
            <option value="all">Semua Router ({devices.length})</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setTypeFilter('rsc')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                typeFilter === 'rsc'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              .rsc (Teks)
            </button>
            <button
              onClick={() => setTypeFilter('backup')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                typeFilter === 'backup'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              .backup
            </button>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="px-4 py-2.5 bg-slate-50/40 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center space-x-2">
          <span>
            Menampilkan <strong className="text-slate-900">{filtered.length}</strong> file konfigurasi
          </span>
          <span>&bull;</span>
          <span>
            Total ukuran: <strong className="text-slate-900">{formatBytes(totalFilteredSize)}</strong>
          </span>
        </div>
        <button
          onClick={onOpenUpload}
          className="text-blue-600 hover:text-blue-700 font-semibold hover:underline text-xs cursor-pointer"
        >
          + Unggah File Backup
        </button>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <FileCode className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Tidak ada riwayat backup</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || selectedDeviceFilter !== 'all' || typeFilter !== 'all'
                ? 'Tidak ada hasil yang sesuai dengan kriteria filter saat ini.'
                : 'Belum ada konfigurasi yang tersimpan. Gunakan tombol "Backup Sekarang" pada router atau jalankan skrip di terminal MikroTik.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Nama File &amp; Tipe</th>
                <th className="py-3 px-4">Router &amp; IP</th>
                <th className="py-3 px-4">Waktu Backup</th>
                <th className="py-3 px-4">Metode Trigger</th>
                <th className="py-3 px-4">Ukuran</th>
                <th className="py-3 px-4 text-right">Aksi Unduh &amp; Periksa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map(backup => {
                const isRsc = backup.fileType === 'rsc';

                return (
                  <tr
                    key={backup.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Filename & Type Icon */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isRsc
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}
                        >
                          <FileCode className="w-4 h-4" />
                        </div>
                        <div>
                          <p
                            className="font-bold text-slate-900 font-mono text-xs hover:text-blue-600 cursor-pointer truncate max-w-xs sm:max-w-md"
                            onClick={() => (isRsc ? onViewContent(backup) : null)}
                            title={backup.filename}
                          >
                            {backup.filename}
                          </p>
                          {backup.notes && (
                            <p className="text-[11px] text-slate-500 italic truncate max-w-xs">
                              {backup.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Router Name & IP */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{backup.deviceName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{backup.deviceIp}</div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{formatDate(backup.createdAt)}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatTimeAgo(backup.createdAt)}
                      </div>
                    </td>

                    {/* Trigger */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTriggerBadge(backup.trigger)}
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700 font-medium">
                      {formatBytes(backup.fileSize)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Direct Download Button */}
                        <a
                          href={api.getDownloadUrl(backup.id)}
                          download={backup.filename}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs"
                          title="Unduh file konfigurasi ke komputer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh</span>
                        </a>

                        {/* View Content (only for .rsc text files) */}
                        {isRsc && (
                          <button
                            onClick={() => onViewContent(backup)}
                            className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors border border-slate-200 cursor-pointer font-medium"
                            title="Buka isi script RouterOS di layar"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Lihat</span>
                          </button>
                        )}

                        {/* Diff Compare */}
                        {isRsc && (
                          <button
                            onClick={() => onCompare(backup)}
                            className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs transition-colors border border-purple-200 cursor-pointer font-medium"
                            title="Bandingkan perubahan dengan backup lain"
                          >
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            <span>Diff</span>
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => onDelete(backup)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus backup ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
