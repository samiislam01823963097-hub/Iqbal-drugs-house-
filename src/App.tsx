import { useState, useEffect } from 'react';
import { Medicine, Bill, Order, UserRole } from './types';
import { API } from './services/api';

// Components
import LoginScreen from './components/LoginScreen';
import BillingPanel from './components/BillingPanel';
import InventoryPanel from './components/InventoryPanel';
import AdminPanel from './components/AdminPanel';
import LedgerPanel from './components/LedgerPanel';
import OrdersPanel from './components/OrdersPanel';
import SafetyStockAlert from './components/SafetyStockAlert';

// Icons
import {
  Pill,
  Moon,
  Sun,
  Activity,
  LogOut,
  FolderLock,
  Layers,
  FileSpreadsheet,
  TrendingDown,
  Warehouse,
  ShieldCheck,
  CheckCircle,
  Truck,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: UserRole } | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [activePanel, setActivePanel] = useState('billing');
  const [darkMode, setDarkMode] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Online / Offline states
  const [isOnline, setIsOnline] = useState(API.isOnline());
  const [pendingCount, setPendingCount] = useState(API.getPendingCount());

  // Load state from local storage token to automatically login if session is persistent
  useEffect(() => {
    const savedUser = localStorage.getItem('iqbal_user_session');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
      } catch (err) {
        console.warn("Stale session could not be parse", err);
      }
    }

    // Check dark mode
    const systemDark = localStorage.getItem('iqbal_dark_theme') === 'true';
    if (systemDark) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Sync Master Data lists from database
  const syncMasterData = async () => {
    if (!currentUser) return;
    setSyncing(true);
    try {
      const allMeds = await API.getMedicines();
      const allBills = await API.getBills();
      const allOrders = await API.getOrders();
      
      setMedicines(allMeds);
      setBills(allBills);
      setOrders(allOrders);
      setLastSynced(new Date());
    } catch (err) {
      console.error("Master Synchronization failed", err);
    } finally {
      setSyncing(false);
    }
  };

  // Subscribe to API sync queue changes & handle network status changes
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = API.subscribeToSyncStatus((status) => {
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
      if (status.syncing !== syncing) {
        setSyncing(status.syncing);
      }
    });

    // Automatically trigger upload execution if connectivity returns
    if (isOnline && pendingCount > 0) {
      setSyncing(true);
      API.syncPendingData()
        .then(() => syncMasterData())
        .catch(console.error)
        .finally(() => setSyncing(false));
    }

    // Run a routine sync background check every 25 seconds
    const interval = setInterval(() => {
      if (API.isOnline() && API.getPendingCount() > 0) {
        setSyncing(true);
        API.syncPendingData()
          .then(() => syncMasterData())
          .catch(console.error)
          .finally(() => setSyncing(false));
      }
    }, 25000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser, isOnline, pendingCount]);

  // Sync data reactively whenever logged in
  useEffect(() => {
    if (currentUser) {
      syncMasterData();
    }
  }, [currentUser]);

  // Handle successful login callbacks
  const handleLoginSuccess = (user: { username: string; role: UserRole }) => {
    setCurrentUser(user);
    localStorage.setItem('iqbal_user_session', JSON.stringify(user));
  };

  // Logouts
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('iqbal_user_session');
  };

  // Dark themes toggles
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('iqbal_dark_theme', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('iqbal_dark_theme', 'false');
    }
  };

  // Custom Navigation tabs list
  const navTabs = [
    { id: 'billing', label: 'Bill Counter', icon: Layers },
    { id: 'inventory', label: 'Warehouse Stock', icon: Warehouse },
    { id: 'orders', label: 'Wholesale Orders', icon: Truck },
    { id: 'ledger', label: 'Sales Ledger', icon: FileSpreadsheet },
    { id: 'admin', label: 'Admin Security', icon: FolderLock },
  ];

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 flex flex-col transition-all duration-300`}>
      {/* Complete Header Bar element */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-40 flex items-center justify-between rounded-b-[36px] shadow-xl border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center text-emerald-400 border border-white/10 shadow-inner">
            <Pill className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-md sm:text-lg font-black tracking-tight flex items-center gap-1">
              <span>Iqbal Drug House</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] bg-emerald-600 px-3 py-0.5 rounded-full font-bold uppercase tracking-widest flex items-center gap-1 text-slate-100">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>{currentUser.role === 'admin' ? 'Master Admin' : currentUser.role === 'cashier' ? 'Cashier Desk' : 'Stock Ops'}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Active: <strong className="text-slate-200 capitalize">{currentUser.username}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Global actions and connection heartbeats */}
        <div className="flex items-center gap-2">
          {/* Enhanced Online/Offline State Status Widget */}
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-900/60 px-3 py-1.5 rounded-xl text-neutral-100 text-[10px] md:text-xs">
                <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                <div className="hidden sm:inline">
                  <span className="font-extrabold uppercase text-rose-300">Offline (অফলাইন)</span>
                  {pendingCount > 0 && <span className="ml-1.5 text-slate-300">({pendingCount} queued)</span>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-900/50 px-3 py-1.5 rounded-xl text-neutral-100 text-[10px] md:text-xs">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline font-bold text-emerald-400">Online</span>
              </div>
            )}

            {/* If there are pending operations to sync back to the database */}
            {pendingCount > 0 && isOnline && (
              <button
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await API.syncPendingData();
                    await syncMasterData();
                  } catch (e) {
                    console.error("Manual sync pass errored", e);
                  } finally {
                    setSyncing(false);
                  }
                }}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-2.5 py-1.5 rounded-xl text-[10px] md:text-xs transition-transform cursor-pointer shadow-md"
                title="Sync queued data to cloud"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync {pendingCount} ({pendingCount} সিঙ্ক করুন)</span>
              </button>
            )}
          </div>

          <button
            onClick={toggleDarkMode}
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 p-2.5 rounded-2xl text-slate-300 transition-transform active:scale-95 cursor-pointer"
            title="Theme switch Toggle"
          >
            {darkMode ? <Sun className="w-4 h-4 text-emerald-400" /> : <Moon className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={handleLogout}
            className="bg-slate-800/80 hover:bg-rose-950/30 hover:border-rose-900 border border-slate-700/50 p-2.5 rounded-2xl text-slate-350 hover:text-rose-400 transition-colors cursor-pointer"
            title="System Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main operational panel renderer container */}
      <main className="flex-1 p-4 max-w-7xl w-full mx-auto print:p-0 print:m-0">
        <SafetyStockAlert
          medicines={medicines}
          onRestockSuccess={syncMasterData}
          userRole={currentUser.role}
        />

        <div className="py-4">
          {activePanel === 'billing' && (
            <BillingPanel
              medicines={medicines}
              onRefresh={syncMasterData}
              cashierName={currentUser.username}
            />
          )}

          {activePanel === 'inventory' && (
            <InventoryPanel
              medicines={medicines}
              onRefresh={syncMasterData}
              userRole={currentUser.role}
            />
          )}

          {activePanel === 'orders' && (
            <OrdersPanel
              medicines={medicines}
              orders={orders}
              onRefresh={syncMasterData}
              userRole={currentUser.role}
            />
          )}

          {activePanel === 'ledger' && (
            <LedgerPanel
              medicines={medicines}
              bills={bills}
              onRefresh={syncMasterData}
              userRole={currentUser.role}
            />
          )}

          {activePanel === 'admin' && (
            <AdminPanel
              medicines={medicines}
              onRefresh={syncMasterData}
              userRole={currentUser.role}
            />
          )}
        </div>
      </main>

      {/* Persistent global Navigation dock layout at bottom */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/80 flex justify-around items-center p-2.5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] z-40 print:hidden">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePanel === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={`flex flex-col items-center gap-1.5 py-1.5 px-3 rounded-2xl cursor-pointer transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-extrabold uppercase tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
