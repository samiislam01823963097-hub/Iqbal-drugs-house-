import { useState, useEffect, useMemo } from 'react';
import { Medicine, UserRole } from '../types';
import { API } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Plus, 
  Sliders, 
  Bell, 
  TrendingDown,
  Check,
  Package,
  Wrench,
  CornerDownLeft,
  Truck
} from 'lucide-react';

interface SafetyStockAlertProps {
  medicines: Medicine[];
  onRestockSuccess: () => Promise<void>;
  userRole: UserRole;
}

interface ToastMessage {
  id: string;
  medId: number;
  medName: string;
  currentStock: number;
  message: string;
}

export default function SafetyStockAlert({ medicines, onRestockSuccess, userRole }: SafetyStockAlertProps) {
  // State for safety stock threshold (persisted in localStorage)
  const [threshold, setThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('iqbal_safety_stock_threshold');
    return saved ? parseInt(saved, 10) : 10;
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [isBannerVisible, setIsBannerVisible] = useState<boolean>(true);
  const [inlineRestockId, setInlineRestockId] = useState<number | null>(null);
  const [restockQty, setRestockQty] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessId, setActionSuccessId] = useState<number | null>(null);

  // Toast stack state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Store processed warning lists to prevent excessive duplicate toasts on minor state refreshes
  const [lastWarnedIds, setLastWarnedIds] = useState<Set<number>>(new Set());

  // Save threshold when it changes
  const handleThresholdChange = (val: number) => {
    const safeVal = Math.max(1, Math.min(100, val));
    setThreshold(safeVal);
    localStorage.setItem('iqbal_safety_stock_threshold', safeVal.toString());
  };

  // Filter medicines below threshold
  const criticalItems = useMemo(() => {
    return medicines.filter(m => m.stock <= threshold);
  }, [medicines, threshold]);

  // Split into out-of-stock and low-stock for intelligent displays
  const outOfStockItems = useMemo(() => {
    return criticalItems.filter(m => m.stock === 0);
  }, [criticalItems]);

  const lowStockItems = useMemo(() => {
    return criticalItems.filter(m => m.stock > 0);
  }, [criticalItems]);

  // Auto trigger dynamic slide-in toasts when items enter critical range
  useEffect(() => {
    if (medicines.length === 0) return;

    const newWarningSet = new Set<number>();
    const newToasts: ToastMessage[] = [];

    medicines.forEach(m => {
      if (m.stock <= threshold) {
        newWarningSet.add(m.id);
        // If it wasn't warned about in the previous pass, queue a fresh interactive toast!
        if (!lastWarnedIds.has(m.id)) {
          const typeLabel = m.stock === 0 ? "Out of Stock (স্টক আউট হয়েছে)" : `Low Stock warning (${m.stock} units remaining)`;
          newToasts.push({
            id: `toast-${m.id}-${Date.now()}-${Math.random()}`,
            medId: m.id,
            medName: m.name,
            currentStock: m.stock,
            message: `${m.name} (${m.company}) is ${typeLabel}!`
          });
        }
      }
    });

    // Limit initial spam of toasts on login or first load
    if (lastWarnedIds.size === 0) {
      // First boot: toast max 2 critical issues so we don't spam the page
      setToasts(newToasts.slice(0, 2));
    } else if (newToasts.length > 0) {
      // Subsequent events: append directly
      setToasts(prev => [...prev, ...newToasts]);
    }

    setLastWarnedIds(newWarningSet);
  }, [medicines, threshold]);

  // Remove toast
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Inline Quick Restock Action
  const handleInlineRestock = async (medId: number, medName: string) => {
    if (restockQty <= 0) return;
    setIsSubmitting(true);
    try {
      const med = medicines.find(m => m.id === medId);
      if (!med) return;
      
      const newStock = med.stock + restockQty;
      await API.updateMedicine(medId, { stock: newStock });
      
      // Flash a quick Success feedback state on the UI
      setActionSuccessId(medId);
      setTimeout(() => setActionSuccessId(null), 3000);
      
      // Refresh app master lists
      await onRestockSuccess();
      setInlineRestockId(null);
    } catch (err) {
      console.error("Quick inline restock failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip rendering altogether for cashiers
  if (userRole === 'cashier') {
    return null;
  }

  // If there are no critical items, do not render the banner
  if (criticalItems.length === 0) {
    return (
      <div className="z-50 pointer-events-none">
        {/* Render only Float Toasts if banner is idle */}
        <AnimatePresence>
          {toasts.map((toast, index) => (
            <div key={toast.id} className="pointer-events-auto">
              {renderToastElement(toast, index)}
            </div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  function renderToastElement(toast: ToastMessage, idx: number) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        style={{ top: `${80 + idx * 95}px` }}
        className="fixed right-4 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col p-4 mb-3 border-l-4 border-l-amber-500 hover:scale-[1.02] transition-transform"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400">Stock Threshold Alert</h5>
            <p className="text-sm font-semibold tracking-tight text-slate-100 mt-1">
              {toast.message}
            </p>
          </div>
          <button 
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-white cursor-pointer bg-slate-800/50 p-1.5 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-850">
          <span className="text-[10px] text-slate-400 mr-auto font-mono">ID: #{toast.medId}</span>
          <button
            onClick={async () => {
              try {
                const med = medicines.find(m => m.id === toast.medId);
                if (med) {
                  await API.updateMedicine(toast.medId, { stock: med.stock + 50 });
                  await onRestockSuccess();
                  dismissToast(toast.id);
                }
              } catch (e) {
                console.error(e);
              }
            }}
            className="bg-emerald-500 hover:bg-emerald-600 font-extrabold text-slate-950 px-3 py-1 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Instant +50 Units</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative w-full mb-6 print:hidden">
      {/* Toast Render stack */}
      <div className="relative z-50 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast, index) => (
            <div key={toast.id} className="pointer-events-auto">
              {renderToastElement(toast, index)}
            </div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isBannerVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="w-full bg-gradient-to-br from-amber-50 to-amber-100/70 dark:from-slate-900 dark:to-slate-950 border border-amber-200 dark:border-amber-900/30 rounded-[28px] overflow-hidden shadow-[0_8px_30px_rgb(245,158,11,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
          >
            {/* Header Area */}
            <div className="flex items-center justify-between p-4 px-5 border-b border-amber-200/50 dark:border-amber-900/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 dark:bg-amber-500/15 rounded-xl flex items-center justify-center text-slate-900 dark:text-amber-400 border border-amber-300 dark:border-amber-500/20 shadow-sm animate-pulse">
                  <AlertTriangle className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight text-amber-900 dark:text-amber-400 flex items-center gap-2">
                    <span>Critical Stock Level Warning</span>
                    <span className="text-[10px] bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                      {criticalItems.length} items risk shutdown
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-amber-800/85 dark:text-slate-400 font-medium">
                    {outOfStockItems.length > 0 && <span className="font-bold text-rose-600 dark:text-rose-400">{outOfStockItems.length} completely out of stock! </span>}
                    {lowStockItems.length > 0 && <span>{lowStockItems.length} below safety limit ({threshold} units).</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {/* Configuration Panel Toggle */}
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`p-2 rounded-xl transition-all border cursor-pointer ${
                    showConfig 
                      ? 'bg-amber-200 border-amber-300 dark:bg-slate-800 dark:border-slate-700 text-amber-900' 
                      : 'bg-white/40 border-amber-200 dark:bg-slate-900/40 dark:border-slate-850 text-amber-800 dark:text-slate-400 hover:bg-amber-200/50'
                  }`}
                  title="Configure Safety Stock Limit"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>

                {/* Collapse grid indicator */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 bg-white/40 dark:bg-slate-900/45 border border-amber-200 dark:border-slate-850 hover:bg-amber-100 dark:hover:bg-slate-800 rounded-xl text-amber-800 dark:text-slate-300 cursor-pointer transition-all"
                  title={isExpanded ? "Collapse Products" : "Expand detailed sheet"}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Dismiss full banner warning temporarily */}
                <button
                  onClick={() => setIsBannerVisible(false)}
                  className="p-2 bg-rose-50/60 dark:bg-rose-950/10 border border-rose-200/60 dark:border-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-950/20 rounded-xl text-rose-700 dark:text-rose-400 cursor-pointer transition-all"
                  title="Dismiss alert box"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Config View (Shown dynamically when settings icon toggled) */}
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-amber-100/50 dark:bg-slate-950 p-4 px-5 border-b border-amber-200/30 dark:border-slate-900 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs overflow-hidden"
                >
                  <div className="max-w-md">
                    <h4 className="font-extrabold text-amber-900 dark:text-slate-350 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                      <span>Adjust Safety Margin Criteria (নিরাপদ স্টক সীমা পরিবর্তন)</span>
                    </h4>
                    <p className="text-[11px] text-amber-800 dark:text-slate-500 mt-1 select-none leading-relaxed">
                      Products with stocks at or below this value generate automatic red-amber dashboards warnings & stock alerts. Adjust the margin to fit your current storage.
                    </p>
                  </div>
                  <div className="flex items-center gap-3.5 bg-white/70 dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-2.5 rounded-2xl flex-shrink-0 self-start sm:self-auto">
                    <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase">Safety Limit:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleThresholdChange(threshold - 5)}
                        className="w-7 h-7 bg-amber-100 dark:bg-slate-800 text-amber-950 dark:text-slate-200 font-extrabold flex items-center justify-center rounded-lg hover:bg-amber-200 cursor-pointer active:scale-90"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleThresholdChange(threshold - 1)}
                        className="w-7 h-7 bg-amber-100 dark:bg-slate-800 text-amber-950 dark:text-slate-200 font-extrabold flex items-center justify-center rounded-lg hover:bg-amber-200 cursor-pointer active:scale-90"
                      >
                        -1
                      </button>
                      
                      <span className="w-12 text-center text-sm font-black font-mono text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-950 px-1 border border-slate-200 dark:border-slate-850 py-0.5 rounded-md">
                        {threshold}
                      </span>

                      <button
                        onClick={() => handleThresholdChange(threshold + 1)}
                        className="w-7 h-7 bg-amber-100 dark:bg-slate-800 text-amber-950 dark:text-slate-200 font-extrabold flex items-center justify-center rounded-lg hover:bg-amber-200 cursor-pointer active:scale-90"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleThresholdChange(threshold + 5)}
                        className="w-7 h-7 bg-amber-100 dark:bg-slate-800 text-amber-950 dark:text-slate-200 font-extrabold flex items-center justify-center rounded-lg hover:bg-amber-200 cursor-pointer active:scale-90"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List and Stock Actions (Visible when expanded) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-5 overflow-hidden"
                >
                  <p className="text-[10px] text-amber-900/60 dark:text-slate-500 uppercase tracking-widest font-black mb-3 select-none">
                    Medicines below thresholds ({threshold} Units):
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[340px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {criticalItems.map((med) => {
                      const isZero = med.stock === 0;
                      const isActionSuccess = actionSuccessId === med.id;
                      const isRestockFormActive = inlineRestockId === med.id;

                      return (
                        <div
                          key={med.id}
                          className={`relative border p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-250 ${
                            isZero
                              ? 'bg-rose-50/40 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/30 hover:border-rose-300'
                              : 'bg-white/60 dark:bg-slate-900/40 border-amber-200/40 dark:border-slate-850/60 hover:border-amber-300/80 dark:hover:border-slate-700'
                          }`}
                        >
                          {/* Alert Side Strip */}
                          <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-md ${isZero ? 'bg-rose-500' : 'bg-amber-500'}`} />

                          <div className="pl-2">
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <h4 className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-200">
                                  {med.name}
                                </h4>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                  {med.company}
                                </span>
                              </div>
                              
                              <span className={`text-[10px] font-black tracking-tight py-1 px-2.5 rounded-xl ${
                                isZero 
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-450' 
                                  : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400'
                              }`}>
                                {isZero ? 'STOCKED OUT' : `${med.stock} UNITS`}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block mt-1">
                              Salt: {med.salt || 'N/A'}
                            </span>
                            {med.shelf && (
                              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md inline-block mt-1 font-mono">
                                Loc: {med.shelf}
                              </span>
                            )}
                          </div>

                          {/* Quick Stocks Trigger Controllers */}
                          <div className="pl-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            {isActionSuccess ? (
                              <div className="text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5 py-1 select-none animate-bounce">
                                <Check className="w-4 h-4" />
                                <span>Restocked (+{restockQty} Unit)</span>
                              </div>
                            ) : isRestockFormActive ? (
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleInlineRestock(med.id, med.name);
                                }}
                                className="flex items-center gap-1.5 w-full"
                              >
                                <input
                                  type="number"
                                  min="1"
                                  max="500"
                                  value={restockQty}
                                  onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                  className="w-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1 px-1.5 rounded-lg text-xs font-bold outline-none text-center font-mono focus:border-amber-500"
                                  disabled={isSubmitting}
                                  placeholder="Qty"
                                  required
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  className="bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-600 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold flex-1 text-center cursor-pointer flex items-center justify-center gap-1"
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? '...' : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineRestockId(null)}
                                  className="text-slate-400 hover:text-rose-500 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                                  disabled={isSubmitting}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setInlineRestockId(med.id);
                                    setRestockQty(50); // reset to default recommendation
                                  }}
                                  className="text-amber-800 hover:text-amber-950 dark:text-amber-450 dark:hover:text-amber-350 font-bold text-xs flex items-center gap-1 hover:underline cursor-pointer py-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Replenish Stock</span>
                                </button>

                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                                  Ref #{med.id}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
