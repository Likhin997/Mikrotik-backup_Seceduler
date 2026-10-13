import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Server,
  AlertCircle,
  Clock,
  KeyRound,
  ShieldAlert,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';
import { JetCyberLogo } from './JetCyberLogo';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  sessionExpiredMessage?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  sessionExpiredMessage
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(sessionExpiredMessage || null);

  useEffect(() => {
    if (sessionExpiredMessage) {
      setError(sessionExpiredMessage);
    }
  }, [sessionExpiredMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username wajib diisi');
      return;
    }
    if (!password) {
      setError('Password wajib diisi');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.login(username.trim(), password);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Login gagal. Periksa username dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 relative overflow-hidden text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* Background ambient subtle elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/80 via-slate-50 to-slate-100 -z-10" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-6 sm:p-8 relative">
        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <JetCyberLogo variant="vertical" size={140} theme="light" className="mx-auto" />
          <div className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold">
            <span>Sistem Otomasi Backup MikroTik</span>
          </div>
        </div>

        {/* Error / Alert box */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="leading-relaxed font-medium">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username Admin
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username admin..."
                autoComplete="off"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Masuk ke Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Security badges */}
        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
          <div className="flex items-center space-x-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-medium">30m Idle Logout</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-medium">Anti Brute-Force</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} JET CYBER NETWORK &bull; Reach Without Limits &bull; Secured with Scrypt &amp; TLS
      </div>
    </div>
  );
};
