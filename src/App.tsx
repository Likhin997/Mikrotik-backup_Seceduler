import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  HardDrive,
  FileCode,
  Terminal,
  Upload,
  Layers,
  HelpCircle,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { RouterDevice, BackupRecord, SystemStats, ActivityLog } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { DeviceCard } from './components/DeviceCard';
import { DeviceModal } from './components/DeviceModal';
import { ScriptGeneratorModal } from './components/ScriptGeneratorModal';
import { ConfigViewerModal } from './components/ConfigViewerModal';
import { DiffModal } from './components/DiffModal';
import { ManualUploadModal } from './components/ManualUploadModal';
import { BackupTable } from './components/BackupTable';
import { RestoreGuideModal } from './components/RestoreGuideModal';
import { ActivityLogsView } from './components/ActivityLogsView';
import { DockerModal } from './components/DockerModal';
import { Toast, ToastMessage } from './components/Toast';

export default function App() {
  const [activeTab, setActiveTab] = useState<'devices' | 'backups' | 'logs' | 'guide'>('devices');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [devices, setDevices] = useState<RouterDevice[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [triggeringDeviceId, setTriggeringDeviceId] = useState<string | null>(null);

  // Selected filter for backups
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState<string>('all');

  // Modals state
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<RouterDevice | null>(null);

  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [scriptDevice, setScriptDevice] = useState<RouterDevice | null>(null);

  const [isConfigViewerOpen, setIsConfigViewerOpen] = useState(false);
  const [viewingBackup, setViewingBackup] = useState<BackupRecord | null>(null);

  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffBaseBackup, setDiffBaseBackup] = useState<BackupRecord | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRestoreGuideOpen, setIsRestoreGuideOpen] = useState(false);
  const [isDockerModalOpen, setIsDockerModalOpen] = useState(false);

  // Deletion confirms
  const [deletingDevice, setDeletingDevice] = useState<RouterDevice | null>(null);
  const [deletingBackup, setDeletingBackup] = useState<BackupRecord | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Load all data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [statsData, devicesData, backupsData, logsData] = await Promise.all([
        api.getStats(),
        api.getDevices(),
        api.getBackups(),
        api.getLogs()
      ]);
      setStats(statsData);
      setDevices(devicesData);
      setBackups(backupsData);
      setLogs(logsData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (!silent) {
        showToast(err.message || 'Gagal memuat data dari server', 'error');
      }
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();

    // Auto refresh every 15 seconds to sync incoming automatic backups
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Handle Save Device (Add / Edit)
  const handleSaveDevice = async (data: Partial<RouterDevice>) => {
    if (editingDevice) {
      await api.updateDevice(editingDevice.id, data);
      showToast(`Pengaturan router "${data.name}" berhasil diperbarui`, 'success');
    } else {
      const created = await api.createDevice(data);
      showToast(`Router "${created.name}" berhasil ditambahkan ke sistem backup`, 'success');
      // If webhook push, prompt script modal right away!
      setScriptDevice(created);
      setIsScriptModalOpen(true);
    }
    await loadData(true);
  };

  // Handle Delete Device
  const confirmDeleteDevice = async () => {
    if (!deletingDevice) return;
    try {
      await api.deleteDevice(deletingDevice.id);
      showToast(`Router ${deletingDevice.name} dan semua riwayat filenya telah dihapus`, 'success');
      setDeletingDevice(null);
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus router', 'error');
    }
  };

  // Handle Immediate Backup Trigger
  const handleBackupNow = async (device: RouterDevice) => {
    setTriggeringDeviceId(device.id);
    try {
      const res = await api.triggerBackupNow(device.id);
      showToast(res.message, 'success');
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal menjalankan backup instan', 'error');
    } finally {
      setTriggeringDeviceId(null);
    }
  };

  // Handle Delete Backup
  const confirmDeleteBackup = async () => {
    if (!deletingBackup) return;
    try {
      await api.deleteBackup(deletingBackup.id);
      showToast(`File backup ${deletingBackup.filename} berhasil dihapus`, 'success');
      setDeletingBackup(null);
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus backup', 'error');
    }
  };

  // Open diff from config viewer
  const handleCompareFromViewer = (backup: BackupRecord) => {
    setIsConfigViewerOpen(false);
    setDiffBaseBackup(backup);
    setIsDiffModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddDevice={() => {
          setEditingDevice(null);
          setIsDeviceModalOpen(true);
        }}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenDocker={() => setIsDockerModalOpen(true)}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
        totalBackups={backups.length}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* System Overview Stats Bar */}
        <StatsCards
          stats={stats}
          onViewBackups={() => setActiveTab('backups')}
        />

        {/* Tab 1: Routers & Schedule Overview */}
        {activeTab === 'devices' && (
          <div className="space-y-6">
            {/* Header toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center space-x-2">
                  <span>Daftar Router MikroTik</span>
                  <span className="px-2 py-0.5 rounded text-xs font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {devices.length} Perangkat
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kelola jadwal otomatisasi, pantau status koneksi, dan ambil skrip integrasi RouterOS
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRestoreGuideOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                  <span>Panduan Restore</span>
                </button>

                <button
                  onClick={() => {
                    setEditingDevice(null);
                    setIsDeviceModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-md shadow-blue-500/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Router</span>
                </button>
              </div>
            </div>

            {/* Router Cards Grid */}
            {devices.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white">Belum Ada Router MikroTik</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Tambahkan router MikroTik Anda untuk mulai menjadwalkan backup konfigurasi otomatis (.rsc dan .backup) secara terpusat.
                </p>
                <button
                  onClick={() => {
                    setEditingDevice(null);
                    setIsDeviceModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Router Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {devices.map(device => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onBackupNow={handleBackupNow}
                    onViewScript={dev => {
                      setScriptDevice(dev);
                      setIsScriptModalOpen(true);
                    }}
                    onEdit={dev => {
                      setEditingDevice(dev);
                      setIsDeviceModalOpen(true);
                    }}
                    onDelete={dev => setDeletingDevice(dev)}
                    onViewBackups={dev => {
                      setSelectedDeviceFilter(dev.id);
                      setActiveTab('backups');
                    }}
                    isTriggering={triggeringDeviceId === device.id}
                  />
                ))}
              </div>
            )}

            {/* Quick MikroTik Webhook Workflow Banner */}
            <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-cyan-950/40 border border-blue-900/40 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Bagaimana Otomatisasi Backup MikroTik Bekerja?
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Router Anda akan mengekspor konfigurasi secara otomatis pada jadwal yang Anda pilih (misal harian jam 02:00) menggunakan skrip RouterOS bawaan. File konfigurasi dikirim secara aman langsung ke aplikasi ini dan tersimpan rapi untuk diunduh atau dibandingkan kapan saja.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRestoreGuideOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg transition-colors whitespace-nowrap self-end sm:self-center"
                >
                  Pelajari Selengkapnya &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Backup History Table */}
        {activeTab === 'backups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center space-x-2">
                  <FileCode className="w-5 h-5 text-blue-400" />
                  <span>Riwayat & Arsip Konfigurasi</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Daftar seluruh file konfigurasi RouterOS yang tersimpan dan siap diunduh kapan saja
                </p>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah File Backup</span>
              </button>
            </div>

            <BackupTable
              backups={backups}
              devices={devices}
              selectedDeviceFilter={selectedDeviceFilter}
              setSelectedDeviceFilter={setSelectedDeviceFilter}
              onViewContent={backup => {
                setViewingBackup(backup);
                setIsConfigViewerOpen(true);
              }}
              onCompare={backup => {
                setDiffBaseBackup(backup);
                setIsDiffModalOpen(true);
              }}
              onDelete={backup => setDeletingBackup(backup)}
              onOpenUpload={() => setIsUploadModalOpen(true)}
            />
          </div>
        )}

        {/* Tab 3: Activity Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <ActivityLogsView
              logs={logs}
              onRefresh={() => loadData(false)}
            />
          </div>
        )}

        {/* Tab 4: Restore Guide */}
        {activeTab === 'guide' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-semibold text-white mb-2">
                Panduan Pemulihan (Disaster Recovery & Restore)
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Ikuti langkah-langkah di bawah untuk memulihkan konfigurasi MikroTik Anda jika terjadi kerusakan hardware, pergantian router, atau kesalahan konfigurasi.
              </p>

              {/* Directly inline the guide or open the modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-blue-400">
                    <FileCode className="w-5 h-5" />
                    <h3 className="font-semibold text-white text-sm">File Teks (.rsc)</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Format paling aman dan fleksibel. Berisi skrip CLI RouterOS yang dapat diimpor langsung atau disalin sebagian saja.
                  </p>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300">
                    /import file-name=backup.rsc verbose=yes
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>Bisa diedit dengan teks editor biasa</li>
                    <li>Dapat direstore ke tipe router hardware berbeda</li>
                    <li>Mendukung perbandingan visual (Diff)</li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400">
                    <HardDrive className="w-5 h-5" />
                    <h3 className="font-semibold text-white text-sm">File Binary (.backup)</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Salinan sistem penuh termasuk password login pengguna, sertifikat TLS, dan alamat MAC fisik interface.
                  </p>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-amber-300">
                    WinBox: Files &rarr; Pilih file .backup &rarr; Klik Restore
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>Router akan reboot otomatis setelah pemulihan</li>
                    <li>Hanya direkomendasikan untuk hardware yang identik</li>
                    <li>Menyimpan password asli</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}

      {/* Add / Edit Device Modal */}
      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => {
          setIsDeviceModalOpen(false);
          setEditingDevice(null);
        }}
        onSave={handleSaveDevice}
        initialDevice={editingDevice}
      />

      {/* Script Generator Modal */}
      <ScriptGeneratorModal
        isOpen={isScriptModalOpen}
        onClose={() => {
          setIsScriptModalOpen(false);
          setScriptDevice(null);
        }}
        device={scriptDevice}
      />

      {/* Config Viewer Modal (.rsc) */}
      <ConfigViewerModal
        isOpen={isConfigViewerOpen}
        onClose={() => {
          setIsConfigViewerOpen(false);
          setViewingBackup(null);
        }}
        backup={viewingBackup}
        onCompareWithAnother={handleCompareFromViewer}
      />

      {/* Visual Diff Comparison Modal */}
      <DiffModal
        isOpen={isDiffModalOpen}
        onClose={() => {
          setIsDiffModalOpen(false);
          setDiffBaseBackup(null);
        }}
        baseBackup={diffBaseBackup}
        allBackups={backups}
      />

      {/* Manual File Upload Modal */}
      <ManualUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        devices={devices}
        selectedDeviceId={selectedDeviceFilter !== 'all' ? selectedDeviceFilter : undefined}
        onUploadSuccess={backup => {
          showToast(`File ${backup.filename} berhasil disimpan ke data aplikasi!`, 'success');
          loadData(true);
        }}
      />

      {/* Restore Instructions Guide Modal */}
      <RestoreGuideModal
        isOpen={isRestoreGuideOpen}
        onClose={() => setIsRestoreGuideOpen(false)}
      />

      {/* Docker Deployment Guide Modal */}
      <DockerModal
        isOpen={isDockerModalOpen}
        onClose={() => setIsDockerModalOpen(false)}
      />

      {/* Delete Device Confirmation Dialog */}
      {deletingDevice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-semibold text-white text-base">Hapus Router Ini?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus router <strong className="text-white">{deletingDevice.name}</strong> ({deletingDevice.ipHost})?
              Semua arsip file backup milik router ini juga akan dihapus permanen dari server.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeletingDevice(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteDevice}
                className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-sm"
              >
                Ya, Hapus Router & Arsip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Backup Confirmation Dialog */}
      {deletingBackup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-semibold text-white text-base">Hapus File Backup?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus file backup <strong className="text-white font-mono">{deletingBackup.filename}</strong>? File fisik di server akan dibersihkan dan tidak dapat dipulihkan.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeletingBackup(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteBackup}
                className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-sm"
              >
                Hapus File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
