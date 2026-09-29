import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Plus,
  Minus,
  ArrowRight,
  Download,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { BackupRecord, DiffResponse } from '../types';
import { api } from '../services/api';
import { formatDate } from '../utils/formatters';

interface DiffModalProps {
  baseBackup: BackupRecord | null;
  allBackups: BackupRecord[];
  isOpen: boolean;
  onClose: () => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  baseBackup,
  allBackups,
  isOpen,
  onClose
}) => {
  const [targetBackupId, setTargetBackupId] = useState<string>('');
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(false);

  // Available backups for comparison: same device and .rsc type
  const availableTargets = allBackups.filter(
    b => baseBackup && b.deviceId === baseBackup.deviceId && b.id !== baseBackup.id && b.fileType === 'rsc'
  );

  useEffect(() => {
    if (baseBackup && availableTargets.length > 0 && (!targetBackupId || !availableTargets.some(b => b.id === targetBackupId))) {
      // Default to the most recent other backup
      setTargetBackupId(availableTargets[0].id);
    }
  }, [baseBackup, allBackups]);

  useEffect(() => {
    if (baseBackup && targetBackupId && isOpen) {
      runDiff();
    }
  }, [baseBackup, targetBackupId, isOpen]);

  const runDiff = async () => {
    if (!baseBackup || !targetBackupId) return;
    setLoading(true);
    setError(null);
    try {
      // Compare target (older) with base (newer)
      const data = await api.getDiff(targetBackupId, baseBackup.id);
      setDiffData(data);
    } catch (err: any) {
      setError(err.message || 'Gagal membandingkan konfigurasi');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !baseBackup) return null;

  const targetBackup = allBackups.find(b => b.id === targetBackupId);

  const displayedLines = diffData?.diffLines.filter(l => {
    if (!onlyChanges) return true;
    return l.type === 'added' || l.type === 'removed';
  }) || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Perbandingan Visual Konfigurasi (Config Diff)
              </h3>
              <p className="text-xs text-slate-500">
                Lacak perbedaan aturan firewall, IP, VLAN, dan routing antara 2 versi backup
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

        {/* Comparison Selectors & Stats Bar */}
        <div className="px-6 py-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Version Selector */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 flex items-center space-x-2 shadow-2xs">
              <span className="text-slate-500 font-medium">Versi Pembanding:</span>
              <select
                value={targetBackupId}
                onChange={e => setTargetBackupId(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
              >
                {availableTargets.map(b => (
                  <option key={b.id} value={b.id} className="bg-white text-slate-800">
                    {formatDate(b.createdAt)} - {b.filename}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:inline" />

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <span className="text-blue-700 font-medium">Versi Acuan:</span>
              <span className="text-blue-950 font-bold">
                {formatDate(baseBackup.createdAt)} ({baseBackup.filename})
              </span>
            </div>
          </div>

          {/* Stats Badges & View Filter */}
          <div className="flex items-center space-x-3 text-xs">
            {diffData && (
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
                  <Plus className="w-3 h-3 mr-0.5" /> {diffData.stats.additions} Baris Baru
                </span>
                <span className="px-2 py-0.5 rounded font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center">
                  <Minus className="w-3 h-3 mr-0.5" /> {diffData.stats.deletions} Dihapus
                </span>
              </div>
            )}

            <button
              onClick={() => setOnlyChanges(!onlyChanges)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center space-x-1.5 cursor-pointer ${
                onlyChanges
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : 'bg-white text-slate-700 hover:text-slate-900 border-slate-300 shadow-2xs'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Hanya Perubahan</span>
            </button>
          </div>
        </div>

        {/* Diff Content Box */}
        <div className="flex-1 overflow-auto bg-slate-50 font-mono text-xs p-4 leading-relaxed selection:bg-purple-100 selection:text-purple-900">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-purple-600" />
              Menganalisis perbedaan konfigurasi...
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-rose-600 text-center p-4">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
              <span>{error}</span>
            </div>
          ) : availableTargets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
              <Layers className="w-10 h-10 mb-2 text-slate-400" />
              <p className="text-slate-800 font-bold text-sm">Belum Ada Backup Pembanding</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Diperlukan minimal 2 file backup bertipe teks (.rsc) pada router yang sama untuk melakukan perbandingan visual.
              </p>
            </div>
          ) : displayedLines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
              <p className="text-slate-800 font-bold">Tidak Ada Perbedaan (Konfigurasi Identik)</p>
              <p className="text-xs text-slate-500 mt-1">
                Kedua file backup memiliki isi teks konfigurasi yang persis sama.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {displayedLines.map((line, idx) => {
                  let rowBg = 'hover:bg-slate-100/80';
                  let prefix = ' ';
                  let textColor = 'text-slate-700';

                  if (line.type === 'added') {
                    rowBg = 'bg-emerald-50/90 hover:bg-emerald-100/70 border-l-2 border-emerald-500';
                    prefix = '+';
                    textColor = 'text-emerald-900 font-medium';
                  } else if (line.type === 'removed') {
                    rowBg = 'bg-rose-50/90 hover:bg-rose-100/70 border-l-2 border-rose-500';
                    prefix = '-';
                    textColor = 'text-rose-900 font-medium';
                  }

                  return (
                    <tr key={idx} className={`${rowBg} transition-colors`}>
                      <td className="w-10 pr-2 text-right select-none text-slate-400 text-[11px] align-top font-mono">
                        {line.oldLine || ' '}
                      </td>
                      <td className="w-10 pr-3 text-right select-none text-slate-400 text-[11px] align-top border-r border-slate-200 font-mono">
                        {line.newLine || ' '}
                      </td>
                      <td className="w-6 text-center select-none font-bold text-[11px] align-top pl-2">
                        <span className={line.type === 'added' ? 'text-emerald-600' : line.type === 'removed' ? 'text-rose-600' : 'text-transparent'}>
                          {prefix}
                        </span>
                      </td>
                      <td className={`whitespace-pre-wrap break-all ${textColor} py-0.5`}>
                        {line.text || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center space-x-3">
            <span className="flex items-center text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5"></span>
              Baris Hijau: Penambahan Baru
            </span>
            <span className="flex items-center text-rose-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block mr-1.5"></span>
              Baris Merah: Aturan Dihapus
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                window.location.href = api.getDownloadUrl(baseBackup.id);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 font-semibold shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Versi Acuan</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs font-medium"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
