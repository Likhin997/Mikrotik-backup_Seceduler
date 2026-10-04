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
  const [staticOnly, setStaticOnly] = useState<boolean>(true);
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

  const isDynamicLine = (text: string) => {
    return (
      text.includes('interface=<') ||
      text.includes('gateway=<') ||
      text.includes('<l2tp-') ||
      text.includes('<pptp-') ||
      text.includes('<sstp-') ||
      text.includes('<ovpn-') ||
      text.includes('<macvlan') ||
      text.includes('dynamic=yes') ||
      text.includes('dynamic="true"') ||
      text.includes('dynamic=true')
    );
  };

  const lines = useMemo(() => {
    return content.split(/\r?\n/);
  }, [content]);

  // Classify each line into its respective section category
  const parsedLines = useMemo(() => {
    let currentCategory = 'header';

    return lines.map((text, idx) => {
      const trimmed = text.trim();
      if (trimmed.startsWith('/')) {
        const lower = trimmed.toLowerCase();
        if (
          lower.startsWith('/interface') ||
          lower.startsWith('/port')
        ) {
          currentCategory = 'interface';
        } else if (lower.startsWith('/ip address')) {
          currentCategory = 'ip_address';
        } else if (
          lower.startsWith('/ip pool') ||
          lower.startsWith('/ip dhcp')
        ) {
          currentCategory = 'dhcp_pool';
        } else if (
          lower.startsWith('/ip firewall filter') ||
          lower.startsWith('/ip firewall raw')
        ) {
          currentCategory = 'firewall_filter';
        } else if (
          lower.startsWith('/ip firewall nat') ||
          lower.startsWith('/ip firewall mangle') ||
          lower.startsWith('/ip firewall address-list') ||
          lower.startsWith('/ip firewall layer7-protocol') ||
          lower.startsWith('/ip firewall service-port')
        ) {
          currentCategory = 'firewall_nat';
        } else if (
          lower.startsWith('/ip route') ||
          lower.startsWith('/routing')
        ) {
          currentCategory = 'routing';
        } else if (
          lower.startsWith('/system') ||
          lower.startsWith('/ip dns') ||
          lower.startsWith('/ip service') ||
          lower.startsWith('/ip neighbor') ||
          lower.startsWith('/tool') ||
          lower.startsWith('/user') ||
          lower.startsWith('/ppp') ||
          lower.startsWith('/certificate') ||
          lower.startsWith('/radius') ||
          lower.startsWith('/snmp')
        ) {
          currentCategory = 'system';
        } else {
          currentCategory = 'other';
        }
      }

      return {
        text,
        lineNum: idx + 1,
        category: currentCategory
      };
    });
  }, [lines]);

  // Section tabs with accurate counts
  const sections = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      interface: 0,
      ip_address: 0,
      dhcp_pool: 0,
      firewall_filter: 0,
      firewall_nat: 0,
      routing: 0,
      system: 0
    };

    parsedLines.forEach(item => {
      if (staticOnly && isDynamicLine(item.text)) return;
      const trimmed = item.text.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        counts.all++;
        if (counts[item.category] !== undefined) {
          counts[item.category]++;
        }
      }
    });

    return [
      { id: 'all', name: 'Semua', count: counts.all },
      { id: 'interface', name: 'Interfaces & VLAN', count: counts.interface },
      { id: 'ip_address', name: 'IP Address', count: counts.ip_address },
      { id: 'dhcp_pool', name: 'DHCP & Pool', count: counts.dhcp_pool },
      { id: 'firewall_filter', name: 'Firewall Filter', count: counts.firewall_filter },
      { id: 'firewall_nat', name: 'Firewall NAT', count: counts.firewall_nat },
      { id: 'routing', name: 'Routing', count: counts.routing },
      { id: 'system', name: 'System & DNS', count: counts.system }
    ];
  }, [parsedLines, staticOnly]);

  const filteredLines = useMemo(() => {
    return parsedLines.filter(item => {
      if (staticOnly && isDynamicLine(item.text)) {
        return false;
      }

      const matchSearch = searchQuery
        ? item.text.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      if (!matchSearch) return false;
      if (activeSection === 'all') return true;

      return item.category === activeSection;
    });
  }, [parsedLines, searchQuery, activeSection, staticOnly]);

  if (!isOpen || !backup) return null;

  const handleCopy = () => {
    const textToCopy = staticOnly
      ? filteredLines.map(l => l.text).join('\n')
      : content;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    window.location.href = api.getDownloadUrl(backup.id);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base tracking-tight truncate max-w-md">
                  {backup.filename}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  {backup.fileType.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center space-x-3 mt-0.5">
                <span>Router: <strong className="text-slate-700">{backup.deviceName}</strong> ({backup.deviceIp})</span>
                <span>&bull;</span>
                <span>Ukuran: <strong className="text-slate-700">{formatBytes(backup.fileSize)}</strong></span>
                <span>&bull;</span>
                <span>Waktu: {formatDate(backup.createdAt)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onCompareWithAnother && backup.fileType === 'rsc' && (
              <button
                onClick={() => onCompareWithAnother(backup)}
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bandingkan Perubahan (Diff)</span>
              </button>
            )}

            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors shadow-2xs cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salin Semua</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh File</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Section shortcuts */}
        <div className="px-6 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Search inside script */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari IP, interface, firewall, VLAN..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* Quick jump tags */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full text-xs">
            {/* Static / Dynamic Toggle Button */}
            <button
              onClick={() => setStaticOnly(!staticOnly)}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border shrink-0 cursor-pointer ${
                staticOnly
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-semibold'
                  : 'bg-white text-slate-600 border-slate-300 hover:text-slate-900'
              }`}
              title={staticOnly ? 'Mode saat ini: Hanya statis. Klik untuk menampilkan semua (termasuk dinamis)' : 'Mode saat ini: Menampilkan semua. Klik untuk menyaring yang dinamis'}
            >
              <Check className={`w-3 h-3 ${staticOnly ? 'text-emerald-600' : 'opacity-30'}`} />
              <span>{staticOnly ? 'Hanya Statis' : 'Semua (Termasuk Dinamis)'}</span>
            </button>

            <span className="text-slate-300 text-[11px] px-1 hidden lg:inline">|</span>
            <span className="text-slate-500 text-[11px] mr-1 hidden lg:inline font-medium">Seksi:</span>
            {sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSection === sec.id
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <span>{sec.name}</span>
                {sec.count > 0 && sec.id !== 'all' && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      activeSection === sec.id
                        ? 'bg-blue-700/80 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {sec.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-auto bg-slate-50 font-mono text-xs p-4 leading-relaxed selection:bg-blue-100 selection:text-blue-900">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
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

                  let textStyle = 'text-slate-800';
                  if (isComment) textStyle = 'text-emerald-700 italic font-medium';
                  else if (isCommand) textStyle = 'text-blue-700 font-bold';
                  else if (isAddOrSet) textStyle = 'text-indigo-800 font-medium';

                  return (
                    <tr key={lineNum} className="hover:bg-slate-100/90 transition-colors">
                      <td className="w-12 pr-4 text-right select-none text-slate-400 font-mono text-[11px] align-top">
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
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span>
            Menampilkan <strong className="text-slate-800">{filteredLines.length}</strong> dari {lines.length} baris konfigurasi
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
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
