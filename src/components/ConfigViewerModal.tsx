import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileCode,
  Download,
  Copy,
  Check,
  Search,
  Layers,
  Calendar,
  HardDrive,
  Filter
} from 'lucide-react';
import { BackupRecord } from '../types';
import { api } from '../services/api';
import { formatBytes, formatDate } from '../utils/formatters';

interface ConfigViewerModalProps {
  backup: BackupRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onCompareWithAnother?: (backup: BackupRecord) => void;
}

export const ConfigViewerModal: React.FC<ConfigViewerModalProps> = ({
  backup,
  isOpen,
  onClose,
  onCompareWithAnother
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (backup && isOpen) {
      loadContent();
    }
  }, [backup, isOpen]);

  const loadContent = async () => {
    if (!backup) return;
    setLoading(true);
    try {
      const data = await api.getBackupDetail(backup.id);
      setContent(data.content || 'Tidak ada teks isi yang dapat ditampilkan untuk file ini.');
    } catch (err) {
      setContent('# Gagal memuat file konfigurasi dari server');
    } finally {
      setLoading(false);
    }
  };

  const lines = useMemo(() => {
    return content.split(/\r?\n/);
  }, [content]);

  // Section sections detected
  const sections = useMemo(() => {
    const list: { name: string; prefix: string; count: number }[] = [
      { name: 'Semua', prefix: 'all', count: lines.length },
      { name: 'Interfaces & VLAN', prefix: '/interface', count: 0 },
      { name: 'IP Address', prefix: '/ip address', count: 0 },
      { name: 'DHCP & Pool', prefix: '/ip pool', count: 0 },
      { name: 'Firewall Filter', prefix: '/ip firewall filter', count: 0 },
      { name: 'Firewall NAT', prefix: '/ip firewall nat', count: 0 },
      { name: 'Routing', prefix: '/routing', count: 0 },
      { name: 'System & Identity', prefix: '/system', count: 0 }
    ];

    lines.forEach(l => {
      const trimmed = l.trim();
      if (trimmed.startsWith('/interface')) list[1].count++;
      if (trimmed.startsWith('/ip address')) list[2].count++;
      if (trimmed.startsWith('/ip pool') || trimmed.startsWith('/ip dhcp')) list[3].count++;
      if (trimmed.startsWith('/ip firewall filter')) list[4].count++;
      if (trimmed.startsWith('/ip firewall nat')) list[5].count++;
      if (trimmed.startsWith('/routing') || trimmed.startsWith('/ip route')) list[6].count++;
      if (trimmed.startsWith('/system')) list[7].count++;
    });

    return list;
  }, [lines]);

  const filteredLines = useMemo(() => {
    return lines.map((text, idx) => ({ text, lineNum: idx + 1 })).filter(item => {
      const matchSearch = searchQuery
        ? item.text.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      if (!matchSearch) return false;
      if (activeSection === 'all') return true;

      // Filter by section
      return item.text.startsWith(activeSection) || activeSection.split(' ').some(k => item.text.includes(k));
    });
  }, [lines, searchQuery, activeSection]);

  if (!isOpen || !backup) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    window.location.href = api.getDownloadUrl(backup.id);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-white text-base tracking-tight truncate max-w-md">
                  {backup.filename}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {backup.fileType.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center space-x-3 mt-0.5">
                <span>Router: <strong className="text-slate-200">{backup.deviceName}</strong> ({backup.deviceIp})</span>
                <span>&bull;</span>
                <span>Ukuran: <strong className="text-slate-200">{formatBytes(backup.fileSize)}</strong></span>
                <span>&bull;</span>
                <span>Waktu: {formatDate(backup.createdAt)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onCompareWithAnother && backup.fileType === 'rsc' && (
              <button
                onClick={() => onCompareWithAnother(backup)}
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bandingkan Perubahan (Diff)</span>
              </button>
            )}

            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Semua</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh File</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Section shortcuts */}
        <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Search inside script */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari IP, interface, firewall, VLAN..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* Quick jump tags */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 max-w-full text-xs">
            <span className="text-slate-500 text-[11px] mr-1 hidden lg:inline">Filter Seksi:</span>
            {sections.slice(0, 6).map(sec => (
              <button
                key={sec.prefix}
                onClick={() => setActiveSection(sec.prefix)}
                className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                  activeSection === sec.prefix
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {sec.name}
              </button>
            ))}
          </div>
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-auto bg-slate-950 font-mono text-xs p-4 leading-relaxed selection:bg-blue-900 selection:text-white">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              Memuat konfigurasi...
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Tidak ada baris konfigurasi yang cocok dengan pencarian "{searchQuery}"
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {filteredLines.map(({ text, lineNum }) => {
                  const isComment = text.trim().startsWith('#');
                  const isCommand = text.trim().startsWith('/');
                  const isAddOrSet = text.trim().startsWith('add') || text.trim().startsWith('set');

                  let textStyle = 'text-slate-300';
                  if (isComment) textStyle = 'text-emerald-500/90 italic';
                  else if (isCommand) textStyle = 'text-cyan-400 font-semibold';
                  else if (isAddOrSet) textStyle = 'text-blue-300';

                  return (
                    <tr key={lineNum} className="hover:bg-slate-900/60 transition-colors">
                      <td className="w-12 pr-4 text-right select-none text-slate-600 font-mono text-[11px] align-top">
                        {lineNum}
                      </td>
                      <td className={`whitespace-pre-wrap break-all ${textStyle}`}>
                        {text || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>
            Menampilkan {filteredLines.length} dari {lines.length} baris konfigurasi
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simpan ke Komputer (.rsc)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
