import React, { useState } from 'react';
import { X, Upload, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { RouterDevice, BackupRecord } from '../types';
import { api } from '../services/api';
import { formatBytes } from '../utils/formatters';

interface ManualUploadModalProps {
  devices: RouterDevice[];
  selectedDeviceId?: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (backup: BackupRecord) => void;
}

export const ManualUploadModal: React.FC<ManualUploadModalProps> = ({
  devices,
  selectedDeviceId,
  isOpen,
  onClose,
  onUploadSuccess
}) => {
  const [deviceId, setDeviceId] = useState(selectedDeviceId || (devices[0]?.id || ''));
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId) {
      setError('Pilih router target');
      return;
    }
    if (!file) {
      setError('Pilih file konfigurasi (.rsc atau .backup)');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'rsc' && ext !== 'backup') {
      setError('Format file harus berupa .rsc (Script Text) atau .backup (Binary)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deviceId', deviceId);
      formData.append('type', ext === 'backup' ? 'backup' : 'rsc');
      formData.append('trigger', 'manual');
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      const res = await api.uploadBackup(formData);
      onUploadSuccess(res.backup);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal mengunggah file backup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                Unggah File Backup MikroTik
              </h3>
              <p className="text-xs text-slate-400">
                Simpan file ekspor konfigurasi (.rsc) atau file binary (.backup) ke aplikasi
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Target Router */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Router Tujuan
            </label>
            <select
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ipHost}) - {d.model}
                </option>
              ))}
            </select>
          </div>

          {/* File Dropzone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              file
                ? 'border-blue-500/50 bg-blue-500/5'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
            }`}
          >
            {file ? (
              <div className="space-y-2">
                <FileCode className="w-10 h-10 mx-auto text-blue-400" />
                <div>
                  <p className="text-sm font-semibold text-white truncate max-w-xs mx-auto">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(file.size)} &bull; {file.name.endsWith('.rsc') ? 'Script Text (.rsc)' : 'Binary Backup (.backup)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Ganti File
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-slate-500" />
                <div>
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    Klik untuk memilih file
                  </label>
                  <span className="text-xs text-slate-400"> atau seret ke sini</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Mendukung file .rsc (Script) dan .backup (MikroTik Binary) hingga 50 MB
                </p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".rsc,.backup"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Catatan Backup (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="misal: Backup sebelum upgrade RouterOS v7.16"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Mengunggah & Menyimpan...' : 'Simpan ke Aplikasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
