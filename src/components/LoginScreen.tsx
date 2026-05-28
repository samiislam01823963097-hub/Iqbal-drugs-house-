import { useState, FormEvent } from 'react';
import { Pill, Shield, KeyRound, Loader2 } from 'lucide-react';
import { API } from '../services/api';
import { UserRole } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: { username: string; role: UserRole }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await API.login(username, password, role);
      if (data.success) {
        onLoginSuccess({ username: data.username, role: data.role });
      }
    } catch (err: any) {
      setError(err.message || "Invalid login credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const setCredentials = (user: string, pass: string, r: UserRole) => {
    setUsername(user);
    setPassword(pass);
    setRole(r);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl transition-all duration-300">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-inner">
            <Pill className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Iqbal Drug House</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Complete Pharmacy Management System</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 flex-shrink-0 animate-ping" />
            <p className="flex-1 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                <Shield className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-2xl py-3 pl-11 pr-4 text-slate-900 dark:text-white text-sm outline-none transition-all duration-200"
                placeholder="Enter username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-2xl py-3 pl-11 pr-4 text-slate-900 dark:text-white text-sm outline-none transition-all duration-200"
                placeholder="Enter password"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Select Role Portal</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-2xl py-3 px-4 text-slate-900 dark:text-white text-sm outline-none transition-all duration-200 cursor-pointer"
            >
              <option value="admin">Admin Portal (Full Access)</option>
              <option value="cashier">Cashier Portal (Invoicing Only)</option>
              <option value="stock_manager">Stock Manager Portal</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-2xl shadow-lg hover:shadow-emerald-600/20 active:scale-98 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Portal...</span>
              </>
            ) : (
              <span>🔐 Access System</span>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5 text-center">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Authorized Credentials Reference</p>
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div>Admin Portal: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">admin / admin123</span></div>
            <div>Cashier Portal: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">cashier / cashier123</span></div>
            <div>Stock Manager: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">stock / stock123</span></div>
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 mt-2.5 font-medium">
            💡 "admin" & "admin123" can log into any portal.
          </p>
        </div>
      </div>
    </div>
  );
}
