import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Trash2,
  Clock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { ActivityLog } from '../types';
import { formatDate, formatTimeAgo } from '../utils/formatters';

interface ActivityLogsViewProps {
  logs: ActivityLog[];
  onRefresh: () => void;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({ logs, onRefresh }) => {
  const getLogIcon = (type: string) => {
    switch (type) {
      case 'backup_success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'backup_failed':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'device_added':
      case 'device_updated':
        return <PlusCircle className="w-4 h-4 text-blue-600" />;
      case 'device_deleted':
        return <Trash2 className="w-4 h-4 text-rose-600" />;
      case 'cleaned_retention':
        return <ShieldCheck className="w-4 h-4 text-amber-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-sm">
            Log Aktivitas &amp; Penjadwalan Sistem
          </h3>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Log</span>
        </button>
      </div>

      <div className="p-4">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Belum ada aktivitas tercatat
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start space-x-3 p-3 rounded-lg bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="p-1 rounded-md bg-white border border-slate-200 shrink-0 mt-0.5">
                  {getLogIcon(log.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {log.message}
                    </p>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                      {formatTimeAgo(log.timestamp)}
                    </span>
                  </div>
                  {log.deviceName && (
                    <span className="inline-block mt-1 text-[11px] font-mono px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                      {log.deviceName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
