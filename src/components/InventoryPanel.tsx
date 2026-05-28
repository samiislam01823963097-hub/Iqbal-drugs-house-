import { useState, useMemo, FormEvent } from 'react';
import { Medicine, UserRole } from '../types';
import { API } from '../services/api';
import { Search, Filter, AlertTriangle, Printer, Layers, RotateCw, Plus, Calendar, Bookmark, CreditCard, Building } from 'lucide-react';

interface InventoryPanelProps {
  medicines: Medicine[];
  onRefresh: () => Promise<void>;
  userRole: UserRole;
}

export default function InventoryPanel({ medicines, onRefresh, userRole }: InventoryPanelProps) {
  const [search, setSearch] = useState('');
  const [stockType, setStockType] = useState<'all' | 'low' | 'out' | 'expired'>('all');
  const [quickStockId, setQuickStockId] = useState<number | null>(null);
  
  // Print & Reports State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printReportType, setPrintReportType] = useState<'full' | 'reorder' | 'expired' | 'tags'>('full');
  
  // Quick restock state
  const [addQty, setAddQty] = useState<number>(50);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Filter Logics
  const filteredMeds = useMemo(() => {
    let list = medicines;
    
    // 1. Search Query
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        m.salt.toLowerCase().includes(q)
      );
    }

    // 2. Filter Types
    if (stockType === 'low') {
      list = list.filter(m => m.stock > 0 && m.stock <= 10);
    } else if (stockType === 'out') {
      list = list.filter(m => m.stock <= 0);
    } else if (stockType === 'expired') {
      list = list.filter(m => m.expiry && new Date(m.expiry) < new Date());
    }

    return list;
  }, [medicines, search, stockType]);

  // Open Quick Restock Modal
  const handleOpenRestock = (med: Medicine) => {
    setQuickStockId(med.id);
    setCostPrice(med.purchasePrice || med.sellingPrice * 0.7);
    setAddQty(50);
    // Suggest current layout expiry
    setExpiryDate(med.expiry || '');
  };

  // Submit Quick stock update
  const handleConfirmRestock = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickStockId) return;
    setLoading(true);
    setMessage(null);

    try {
      const med = medicines.find(m => m.id === quickStockId);
      if (!med) throw new Error("Medicine not found");

      const finalStock = med.stock + Math.max(1, addQty);
      const finalCost = costPrice > 0 ? costPrice : med.purchasePrice;

      await API.updateMedicine(quickStockId, {
        stock: finalStock,
        purchasePrice: finalCost,
        expiry: expiryDate || med.expiry
      });

      // Also submit a quick purchase order record to historical purchase tab!
      try {
        await fetch("/api/returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billNo: `RESTOCK-${Date.now() % 1000}`,
            medId: quickStockId,
            qty: addQty
          })
        });
      } catch (e) {
        console.warn("Could not log return backup info, continuing", e);
      }

      await onRefresh();
      setMessage("Stock updated successfully!");
      setTimeout(() => {
        setQuickStockId(null);
        setMessage(null);
      }, 1500);
    } catch (err: any) {
      setMessage(`Error: ${err.message || "Failed to update"}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintCatalog = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Search Header card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <h2 className="text-md font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500 animate-pulse" />
            <span>Warehouse Stock Intelligence</span>
          </h2>

          <div className="flex gap-2">
            <button
              onClick={handlePrintCatalog}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold p-2.5 rounded-2xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Stock Statement</span>
            </button>
            <button
              onClick={onRefresh}
              className="border border-slate-200 dark:border-slate-800 text-slate-500 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              title="Sync Catalog"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters and search triggers */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Active Salt, Drug Name, Company Co..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 pl-10 pr-4 py-2.5 rounded-2xl text-xs outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex-shrink-0">
              <button
                onClick={() => setStockType('all')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                  stockType === 'all' ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'text-slate-500'
                }`}
              >
                All SKUs ({medicines.length})
              </button>
              <button
                onClick={() => setStockType('low')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                  stockType === 'low' ? 'bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400' : 'text-slate-500'
                }`}
              >
                Low stock ({medicines.filter(m => m.stock > 0 && m.stock <= 10).length})
              </button>
              <button
                onClick={() => setStockType('out')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                  stockType === 'out' ? 'bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400' : 'text-slate-500'
                }`}
              >
                Stock Out ({medicines.filter(m => m.stock <= 0).length})
              </button>
              <button
                onClick={() => setStockType('expired')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                  stockType === 'expired' ? 'bg-purple-150 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400' : 'text-slate-500'
                }`}
              >
                Expired ({medicines.filter(m => m.expiry && new Date(m.expiry) < new Date()).length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog stock list view */}
      <div id="stock-statement-area" className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-1 print:border-none print:shadow-none">
        {filteredMeds.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 text-center rounded-3xl text-slate-400">
            <AlertTriangle className="w-10 h-10 mx-auto opacity-30 text-slate-400 mb-2" />
            <p className="text-xs font-semibold">No warehouse medicines match filters.</p>
            <p className="text-[10px]">Adjust search queries or clear selected filter views.</p>
          </div>
        ) : (
          filteredMeds.map(med => {
            const isOutOfStock = med.stock <= 0;
            const isLowStock = med.stock > 0 && med.stock <= 10;
            const isExpired = med.expiry && new Date(med.expiry) < new Date();

            return (
              <div
                key={med.id}
                className={`bg-white dark:bg-slate-900 border p-4 rounded-3xl flex justify-between gap-4 transition-all duration-200 relative overflow-hidden group ${
                  isOutOfStock 
                    ? 'border-rose-100 dark:border-rose-950 bg-rose-50/10 dark:bg-rose-950/5'
                    : isExpired
                    ? 'border-purple-200 dark:border-purple-950 bg-purple-50/10 dark:bg-purple-950/5'
                    : isLowStock
                    ? 'border-amber-100 dark:border-amber-950 bg-amber-50/10 dark:bg-amber-950/5 font-medium'
                    : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                {/* Visual Accent for critical ones */}
                {isOutOfStock && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500" />}
                {isExpired && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500" />}
                {isLowStock && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />}

                <div className="space-y-3 flex-1">
                  {/* Name, group, and company details */}
                  <div className="space-y-1">
                    <span className="text-xs font-black text-slate-950 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {med.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-mono font-medium leading-none">
                      Co: {med.company}
                    </span>
                  </div>

                  {/* Pricing grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-50 dark:border-slate-800 pt-2.5">
                    <div>
                      <span className="text-slate-400 block">Buy Price:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">₹{med.purchasePrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Sale Price:</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">₹{med.sellingPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Metadata and shelf room location */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {med.salt && (
                      <span className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[9px] font-bold text-slate-500 px-2 py-0.5 rounded-md font-mono">
                        {med.salt}
                      </span>
                    )}
                    {med.shelf && (
                      <span className="bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-md" title="Physical Storage Locator Room Node">
                        Room Node Shelf: {med.shelf}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Actions: Restock controller */}
                <div className="flex flex-col items-end justify-between font-mono shrink-0">
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-sans">Stock Balance:</span>
                    {isOutOfStock ? (
                      <span className="text-sm font-black text-rose-600 dark:text-rose-450 block">SOLD OUT</span>
                    ) : isExpired ? (
                      <span className="text-sm font-black text-purple-600 dark:text-purple-400 block">EXPIRED</span>
                    ) : isLowStock ? (
                      <span className="text-sm font-extrabold text-amber-500 block">CRITICAL ({med.stock})</span>
                    ) : (
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">{med.stock} u</span>
                    )}
                    {med.expiry && (
                      <span className={`text-[9px] block uppercase font-sans mt-0.5 ${isExpired ? 'text-purple-400 font-bold' : 'text-slate-400'}`}>
                        Exp: {med.expiry}
                      </span>
                    )}
                  </div>

                  {/* Restock action: Only display to users with active permissions */}
                  {userRole !== 'cashier' && (
                    <button
                      type="button"
                      onClick={() => handleOpenRestock(med)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 hover:text-emerald-600 text-[10px] font-bold px-2.5 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 print:hidden"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Quick Stock-in</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Restocking Modal Overlay */}
      {quickStockId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRestock}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-150 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-emerald-500 animate-spin" />
                <span>Restock Invoice Form</span>
              </h3>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-md font-mono text-slate-500">
                ID Ref: {quickStockId}
              </span>
            </div>

            {message && (
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 rounded-xl text-center text-xs font-semibold">
                {message}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Medicine Compound Name</label>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300">
                  {medicines.find(m => m.id === quickStockId)?.name}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Restock Quantity (Add Units)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-550 dark:focus:border-emerald-500 text-xs font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Update Unit Cost Price (₹)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={costPrice}
                  onChange={(e) => setCostPrice(Math.max(0.1, Number(e.target.value) || 0))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Update Expiration Date</span>
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setQuickStockId(null)}
                className="border border-slate-200 dark:border-slate-800 font-bold px-4 py-2 rounded-xl text-slate-500 text-xs hover:bg-slate-50 dark:hover:bg-slate-955 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {loading ? "Saving..." : "Verify Stock-in"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Advanced Print & Reports Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-5 my-8">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Printer className="w-5 h-5 text-emerald-500" />
                  <span>গুদাম স্টক রিপোর্ট প্রিন্ট ডেস্ক (Inventory Reports Desk)</span>
                </h3>
                <p className="text-xs text-slate-500">Select report layout configurations for physical paper outputs</p>
              </div>
              
              {/* Report selection tabs */}
              <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setPrintReportType('full')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    printReportType === 'full'
                      ? 'bg-slate-900 dark:bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Master Ledger (মাস্টার তালিকা)
                </button>
                <button
                  onClick={() => setPrintReportType('reorder')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    printReportType === 'reorder'
                      ? 'bg-slate-900 dark:bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Reorder checklist (ক্রয় চাহিদা)
                </button>
                <button
                  onClick={() => setPrintReportType('expired')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    printReportType === 'expired'
                      ? 'bg-slate-900 dark:bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Purge Waste (মেয়াদোত্তীর্ণ)
                </button>
                <button
                  onClick={() => setPrintReportType('tags')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    printReportType === 'tags'
                      ? 'bg-slate-900 dark:bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Shelf labels (শেলফ বিন ট্যাগ)
                </button>
              </div>
            </div>

            {/* Printable Frame Area with .print-target isolation */}
            <div className="border border-slate-200 dark:border-slate-850 rounded-2xl p-6 bg-slate-50/50 dark:bg-slate-950/40 max-h-[500px] overflow-y-auto">
              <div className="bg-white p-6 border border-slate-200 rounded-3xl space-y-6 shadow-sm text-slate-900 text-xs max-w-3xl mx-auto print-target print:border-none print:shadow-none print:p-0">
                
                {/* Printable Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 text-slate-800">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black tracking-tight uppercase">Iqbal Drug House</h2>
                    <p className="text-[10px] text-slate-500 font-bold">Chowdhury Super Market, Dhaka Road, Bangladesh | Phone: +880-1711100222</p>
                    <p className="text-[10px] text-slate-650">SYSTEM WAREHOUSE STOCK STATEMENT REPORT</p>
                  </div>
                  <div className="text-right text-[10px] space-y-1">
                    <p><strong>Report Date:</strong> <span className="font-mono">{new Date().toLocaleDateString()}</span></p>
                    <p><strong>Sector:</strong> <span className="uppercase font-bold text-slate-700">Storage Warehouse</span></p>
                    <p><strong>Layout:</strong> <span className="uppercase font-bold text-emerald-600">
                      {printReportType === 'full' ? '📚 Master Stock Ledger' : 
                       printReportType === 'reorder' ? '📝 Stock replenishment checklist' : 
                       printReportType === 'expired' ? '⚠️ Shelf Purge Checklist' : '🏷️ Container Tag Labels Grid'}
                    </span></p>
                  </div>
                </div>

                {/* Sub-counts highlights */}
                <div className="grid grid-cols-4 gap-4 bg-slate-50 p-3 rounded-2xl text-[10px] text-slate-600">
                  <div className="text-center border-r border-slate-200 last:border-0">
                    <span className="block text-slate-400">Total Catalog Drug SKUs</span>
                    <strong className="text-xs font-black text-slate-800 font-mono">{medicines.length} items</strong>
                  </div>
                  <div className="text-center border-r border-slate-200 last:border-0">
                    <span className="block text-slate-400">Critical Under-stock</span>
                    <strong className="text-xs font-black text-amber-600 font-mono">{medicines.filter(m => m.stock > 0 && m.stock <= 10).length}</strong>
                  </div>
                  <div className="text-center border-r border-slate-200 last:border-0">
                    <span className="block text-slate-400">Dead Stocks (Sold Out)</span>
                    <strong className="text-xs font-black text-rose-600 font-mono">{medicines.filter(m => m.stock <= 0).length}</strong>
                  </div>
                  <div className="text-center border-r border-slate-200 last:border-0">
                    <span className="block text-slate-400">Expired On Shelf</span>
                    <strong className="text-xs font-black text-purple-650 font-mono">{medicines.filter(m => m.expiry && new Date(m.expiry) < new Date()).length}</strong>
                  </div>
                </div>

                {/* Report Content Switcher */}
                {printReportType === 'full' && (
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider">
                        <th className="py-2">Medicine Compound Title</th>
                        <th className="py-2">Active Salt Ingredient</th>
                        <th className="py-2">Mfg. Brand</th>
                        <th className="py-2 text-center">Shelf Room</th>
                        <th className="py-2 text-right">Unit Buy (₹)</th>
                        <th className="py-2 text-right">Unit Sale (₹)</th>
                        <th className="py-2 text-center">Inventory Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {medicines.map((m, idx) => {
                        const isOut = m.stock <= 0;
                        const isLow = m.stock > 0 && m.stock <= 10;
                        const isExp = m.expiry && new Date(m.expiry) < new Date();
                        return (
                          <tr key={m.id} className="hover:bg-slate-50 text-slate-800">
                            <td className="py-2 max-w-[140px] truncate">
                              <span className="font-bold text-slate-900">{idx + 1}. {m.name}</span>
                              {isExp && <span className="ml-1 px-1 bg-purple-100 text-purple-700 font-black rounded text-[8px] uppercase">Expired</span>}
                            </td>
                            <td className="py-2 text-slate-500 max-w-[120px] truncate">{m.salt || 'N/A'}</td>
                            <td className="py-2 text-slate-500 max-w-[90px] truncate capitalize">{m.company}</td>
                            <td className="py-2 text-center font-mono">RM-{m.shelf || 'A1'}</td>
                            <td className="py-2 text-right font-mono">₹{m.purchasePrice.toFixed(2)}</td>
                            <td className="py-2 text-right font-mono font-bold text-emerald-600">₹{m.sellingPrice.toFixed(2)}</td>
                            <td className="py-2 text-center font-mono">
                              <span className={`px-1.5 py-0.5 rounded font-black ${
                                isOut ? 'bg-rose-100 text-rose-700' :
                                isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {m.stock} unit(s)
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {printReportType === 'reorder' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/50 text-amber-850 text-[10px]">
                      ⚠️ <strong>পুনরায় ক্রয়ের চাহিদা তালিকা (Checklist):</strong> The following listed commodities are below minimum threshold safety levels (10 items). Replenishing active stocks immediately is advised.
                    </div>
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider">
                          <th className="py-2 text-center w-8">Check</th>
                          <th className="py-2">Medicine SKU</th>
                          <th className="py-2">Manufacturer</th>
                          <th className="py-2 text-center">Room Shelf</th>
                          <th className="py-2 text-center">Current Stock</th>
                          <th className="py-2 text-right">Avg Unit Cost</th>
                          <th className="py-2 text-center">Reorder Req. Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {medicines.filter(m => m.stock <= 10).map((m) => (
                          <tr key={m.id} className="text-slate-800">
                            <td className="py-2 text-center">
                              <div className="w-4 h-4 rounded border border-slate-350 mx-auto" />
                            </td>
                            <td className="py-2">
                              <span className="font-bold text-slate-900 block">{m.name}</span>
                              <span className="text-[9px] text-slate-400 block truncate">{m.salt}</span>
                            </td>
                            <td className="py-2 text-slate-500 capitalize">{m.company}</td>
                            <td className="py-2 text-center font-mono">RM-{m.shelf || 'A1'}</td>
                            <td className="py-2 text-center">
                              <span className="font-bold text-rose-600">{m.stock} u</span>
                            </td>
                            <td className="py-2 text-right font-mono">₹{m.purchasePrice.toFixed(2)}</td>
                            <td className="py-2 text-center">
                              <span className="text-slate-300 font-mono">________________ [ ]</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {printReportType === 'expired' && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200/40 text-purple-800 text-[10px]">
                      🧬 <strong>মেয়াদোত্তীর্ণ বর্জ্য নিয়ন্ত্রণ তালিকা (shelf purge worksheet):</strong> List of drugs passed their security chemical safety thresholds. Operators must pull and destroy these immediately to avoid compliance issues.
                    </div>
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-500 uppercase">
                          <th className="py-2 text-center w-8">Purged?</th>
                          <th className="py-2">Compound Brand</th>
                          <th className="py-2">Mfg. Group</th>
                          <th className="py-2 text-center">Room Shelf</th>
                          <th className="py-2 text-center">Expired Date</th>
                          <th className="py-2 text-center">Shelf Stock</th>
                          <th className="py-2 text-right">Total Est. Loss</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {medicines.filter(m => m.expiry && new Date(m.expiry) < new Date()).map((m) => (
                          <tr key={m.id} className="text-slate-800">
                            <td className="py-2 text-center">
                              <div className="w-4 h-4 rounded border border-purple-300 mx-auto" />
                            </td>
                            <td className="py-2">
                              <span className="font-bold text-purple-750 block">{m.name}</span>
                              <span className="text-[9px] text-slate-400 block font-normal font-mono">{m.salt}</span>
                            </td>
                            <td className="py-2 text-slate-500 capitalize">{m.company}</td>
                            <td className="py-2 text-center font-mono text-slate-500">{m.shelf}</td>
                            <td className="py-2 text-center font-mono font-bold text-rose-650">{m.expiry}</td>
                            <td className="py-2 text-center font-mono text-purple-650 font-bold">{m.stock} u</td>
                            <td className="py-2 text-right font-mono font-bold text-rose-500">₹{(m.purchasePrice * m.stock).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {printReportType === 'tags' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-2">
                    {medicines.slice(0, 18).map(m => (
                      <div key={m.id} className="border-2 border-dashed border-slate-350 p-3 rounded-2xl flex flex-col justify-between h-[120px] bg-slate-50/10 text-slate-900 text-[10px] relative print:border-solid">
                        {/* Cut mark */}
                        <div className="absolute right-2 top-2 text-slate-400 text-[9px]" title="Snip to slice tags">✂️ CUT</div>
                        <div>
                          <span className="font-black text-xs block truncate pr-8">{m.name}</span>
                          <span className="text-[9px] text-slate-500 block truncate">{m.salt}</span>
                          <span className="text-[9px] text-slate-400 font-semibold block capitalize">Mfg: {m.company}</span>
                        </div>
                        <div className="border-t border-dashed border-slate-200 mt-2 pt-2 flex justify-between items-end">
                          <div>
                            <span className="text-[8px] text-slate-400 block uppercase font-sans">Bin shelf:</span>
                            <span className="text-[10px] font-black text-slate-800 font-mono">RM-{m.shelf || 'A1'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] text-slate-400 block uppercase font-sans">Unit rate:</span>
                            <strong className="text-xs font-bold text-emerald-600 font-mono">₹{m.sellingPrice}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Verification Sign off */}
                <div className="grid grid-cols-2 gap-8 pt-10 text-[10px] text-slate-400 border-t border-slate-100">
                  <div className="text-center pt-4 border-t border-dashed border-slate-200">
                    <p className="font-bold text-slate-600">Prepared by Warehouse In-charge</p>
                    <p className="text-[8px]">Signature with timestamp seal</p>
                  </div>
                  <div className="text-center pt-4 border-t border-dashed border-slate-200">
                    <p className="font-bold text-slate-600">Verified by System Security Administrator</p>
                    <p className="text-[8px] font-mono">Issued via Digital Auth node</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="border border-slate-200 dark:border-slate-800 font-bold px-5 py-2.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs transition-colors cursor-pointer"
              >
                Close Report Panel
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition-all tracking-tight flex items-center gap-1.5 cursor-pointer shadow-lg shadow-slate-900/10 dark:shadow-emerald-950/20"
              >
                <Printer className="w-4 h-4" />
                <span>Print Paper Copy</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
