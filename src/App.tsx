import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { RouterDevice, BackupRecord, SystemStats, ActivityLog, AuthUser } from './types';
import { api, setUnauthorizedHandler } from './services/api';
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
import { LoginPage } from './components/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { Toast, ToastMessage } from './components/Toast';
import { JetCyberLogo } from './components/JetCyberLogo';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

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

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const lastActiveStr = localStorage.getItem('mikrotik_last_active');
        if (lastActiveStr) {
          const lastActiveTime = parseInt(lastActiveStr, 10);
          if (Date.now() - lastActiveTime > 30 * 60 * 1000) {
            await api.logout();
            setCurrentUser(null);
            setSessionExpiredMessage('Sesi Anda telah kedaluwarsa karena tidak ada aktivitas selama 30 menit. Silakan login kembali.');
            setIsCheckingAuth(false);
            return;
          }
        }

        const res = await api.checkSession();
        if (res.authenticated && res.user) {
          setCurrentUser(res.user);
          lastActivityRef.current = Date.now();
          try {
            localStorage.setItem('mikrotik_last_active', String(Date.now()));
          } catch {}
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    setUnauthorizedHandler(() => {
      setCurrentUser(null);
      setSessionExpiredMessage('Sesi Anda telah kedaluwarsa atau tidak valid. Silakan login kembali.');
    });

    initAuth();
  }, []);

  // 30-Minute Idle Inactivity Auto-Logout Tracker
  useEffect(() => {
    if (!currentUser) return;

    const MAX_IDLE_MS = 30 * 60 * 1000; // 30 minutes

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      try {
        localStorage.setItem('mikrotik_last_active', String(Date.now()));
      } catch {}
    };

    const checkInactivity = async () => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime > MAX_IDLE_MS) {
        try {
          await api.logout();
        } catch {}
        setCurrentUser(null);
        setSessionExpiredMessage('Sesi Anda telah otomatis keluar karena tidak ada aktivitas selama 30 menit demi keamanan sistem.');
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Check inactivity every 10 seconds
    const interval = setInterval(checkInactivity, 10000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, updateActivity));
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [currentUser]);

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
    if (!currentUser) return;
    loadData();

    // Auto refresh every 15 seconds to sync incoming automatic backups
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [currentUser, loadData]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    setCurrentUser(null);
    setSessionExpiredMessage(null);
    showToast('Anda telah berhasil keluar dari sistem.', 'info');
  };

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

  // Loading state while checking active auth session
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800">
        <div className="relative mb-3">
          <JetCyberLogo variant="icon" size={72} theme="light" className="animate-pulse" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        <p className="text-base font-bold text-slate-900 tracking-wide">JET CYBER NETWORK</p>
        <p className="text-[10px] text-slate-500 tracking-[0.25em] uppercase font-bold mt-0.5">REACH WITHOUT LIMITS</p>
        <p className="text-xs text-blue-600 mt-3 font-mono font-medium">Memverifikasi sesi keamanan...</p>
      </div>
    );
  }

  // Not authenticated: Access denied to dashboard, render Login Page only
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setSessionExpiredMessage(null);
            lastActivityRef.current = Date.now();
            try {
              localStorage.setItem('mikrotik_last_active', String(Date.now()));
            } catch {}
            showToast(`Selamat datang kembali, ${user.username}!`, 'success');
          }}
          sessionExpiredMessage={sessionExpiredMessage}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
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
        currentUser={currentUser}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>Daftar Router MikroTik</span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {devices.length} Perangkat
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola jadwal otomatisasi, pantau status koneksi, dan ambil skrip integrasi RouterOS
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRestoreGuideOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Panduan Restore</span>
                </button>

                <button
                  onClick={() => {
                    setEditingDevice(null);
                    setIsDeviceModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Router</span>
                </button>
              </div>
            </div>

            {/* Router Cards Grid */}
            {devices.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
                <Server className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">Belum Ada Router MikroTik</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Tambahkan router MikroTik Anda untuk mulai menjadwalkan backup konfigurasi otomatis (.rsc dan .backup) secara terpusat.
                </p>
                <button
                  onClick={() => {
                    setEditingDevice(null);
                    setIsDeviceModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-xs cursor-pointer"
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
            <div className="bg-gradient-to-r from-blue-50/80 via-white to-cyan-50/80 border border-blue-200 rounded-xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Bagaimana Otomatisasi Backup MikroTik Bekerja?
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      Router Anda akan mengekspor konfigurasi secara otomatis pada jadwal yang Anda pilih (misal harian jam 02:00) menggunakan skrip RouterOS bawaan. File konfigurasi dikirim secara aman langsung ke aplikasi ini dan tersimpan rapi untuk diunduh atau dibandingkan kapan saja.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRestoreGuideOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors whitespace-nowrap self-end sm:self-center cursor-pointer shadow-xs"
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
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <FileCode className="w-5 h-5 text-blue-600" />
                  <span>Riwayat &amp; Arsip Konfigurasi</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Daftar seluruh file konfigurasi RouterOS yang tersimpan dan siap diunduh kapan saja
                </p>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-xs cursor-pointer"
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
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Panduan Pemulihan (Disaster Recovery &amp; Restore)
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Ikuti langkah-langkah di bawah untuk memulihkan konfigurasi MikroTik Anda jika terjadi kerusakan hardware, pergantian router, atau kesalahan konfigurasi.
              </p>

              {/* Directly inline the guide */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center space-x-2 text-blue-600">
                    <FileCode className="w-5 h-5" />
                    <h3 className="font-bold text-slate-900 text-sm">File Teks (.rsc)</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Format paling aman dan fleksibel. Berisi skrip CLI RouterOS yang dapat diimpor langsung atau disalin sebagian saja.
                  </p>
                  <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 font-mono text-xs text-blue-950 font-semibold">
                    /import file-name=backup.rsc verbose=yes
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                    <li>Bisa diedit dengan teks editor biasa</li>
                    <li>Dapat direstore ke tipe router hardware berbeda</li>
                    <li>Mendukung perbandingan visual (Diff)</li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-600">
                    <HardDrive className="w-5 h-5" />
                    <h3 className="font-bold text-slate-900 text-sm">File Binary (.backup)</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Salinan sistem penuh termasuk password login pengguna, sertifikat TLS, dan alamat MAC fisik interface.
                  </p>
                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-mono text-xs text-amber-950 font-semibold">
                    WinBox: Files &rarr; Pilih file .backup &rarr; Klik Restore
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
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

      {/* Jet Cyber Network Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <JetCyberLogo variant="icon" size={28} theme="light" />
            <span className="font-bold text-slate-800">JET CYBER NETWORK</span>
            <span className="text-slate-400">&bull;</span>
            <span className="tracking-[0.2em] text-[10px] text-slate-500 font-bold uppercase">Reach Without Limits</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Sistem Otomasi Backup MikroTik RouterOS &bull; Real-Time Pull &amp; Webhook
          </div>
        </div>
      </footer>

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

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={(msg) => {
          showToast(msg, 'success');
        }}
      />

      {/* Delete Device Confirmation Dialog */}
      {deletingDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Hapus Router Ini?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus router <strong className="text-slate-900">{deletingDevice.name}</strong> ({deletingDevice.ipHost})?
              Semua arsip file backup milik router ini juga akan dihapus permanen dari server.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeletingDevice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteDevice}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Ya, Hapus Router &amp; Arsip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Backup Confirmation Dialog */}
      {deletingBackup && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Hapus File Backup?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus file backup <strong className="text-slate-900 font-mono">{deletingBackup.filename}</strong>? File fisik di server akan dibersihkan dan tidak dapat dipulihkan.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeletingBackup(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteBackup}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer"
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
