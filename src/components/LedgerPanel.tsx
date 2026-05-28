import { useState, useMemo, FormEvent } from 'react';
import { Medicine, Bill, UserRole } from '../types';
import { API } from '../services/api';
import { FileText, Undo2, ArrowUpRight, Search, Activity, RotateCcw, AlertCircle, ShoppingBag, Landmark, ArrowDownLeft, Printer } from 'lucide-react';

interface LedgerPanelProps {
  medicines: Medicine[];
  bills: Bill[];
  onRefresh: () => Promise<void>;
  userRole: UserRole;
}

interface ReturnRecord {
  id: string;
  date: string;
  billNo: string;
  medId: number;
  medName: string;
  qty: number;
}

export default function LedgerPanel({ medicines, bills, onRefresh, userRole }: LedgerPanelProps) {
  // Return States
  const [returnBillNo, setReturnBillNo] = useState('');
  const [returnMedId, setReturnMedId] = useState<number | ''>('');
  const [returnQty, setReturnQty] = useState<number | ''>('');
  const [returnsHistory, setReturnsHistory] = useState<ReturnRecord[]>([]);

  // Reports States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [ledgerReportType, setLedgerReportType] = useState<'sales' | 'cashier' | 'pnl'>('sales');

  // Search invoice state
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load return history once on display
  useMemo(() => {
    API.getReturns().then(data => setReturnsHistory(data)).catch(err => console.error(err));
  }, [bills]);

  // Compute stats helper
  const statistics = useMemo(() => {
    let salesTotal = 0;
    let profitTotal = 0;

    bills.forEach((bill) => {
      salesTotal += bill.grandTotal;
      
      // Calculate profit: Selling Price minus Purchase Price
      bill.items.forEach((item) => {
        // Find corresponding medicine for purchase price index
        const originalMed = medicines.find(m => m.id === item.id);
        const buyPrice = originalMed ? originalMed.purchasePrice : item.sellingPrice * 0.7;
        const profitPerUnit = item.sellingPrice - buyPrice;
        profitTotal += profitPerUnit * item.qty;
      });
    });

    return { salesTotal, profitTotal };
  }, [bills, medicines]);

  // Filter bills
  const filteredBills = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return bills;

    return bills.filter(
      (b) =>
        b.billNo.toLowerCase().includes(q) ||
        b.customer.toLowerCase().includes(q) ||
        (b.cashierName && b.cashierName.toLowerCase().includes(q))
    );
  }, [query, bills]);

  const handleProcessReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!returnBillNo.trim() || !returnMedId || !returnQty || returnQty <= 0) {
      setError("Please specify the Bill No, select the Medicine to return, and specify a valid quantity.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await API.recordReturn(returnBillNo.trim(), Number(returnMedId), Number(returnQty));
      if (data.success) {
        setSuccess(`Successfully returned ${returnQty} unit(s) to inventory. Product stock restored!`);
        
        // Clear forms
        setReturnBillNo('');
        setReturnMedId('');
        setReturnQty('');

        // Refresh parent
        await onRefresh();
        
        // Refresh local returns log
        const updatedLogs = await API.getReturns();
        setReturnsHistory(updatedLogs);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process the return.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Summary Cards widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Gross Turnover Sales</span>
            <span className="text-lg font-black font-mono text-slate-800 dark:text-white">₹{statistics.salesTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Computed Net Earnings</span>
            <span className="text-lg font-black font-mono text-emerald-600">₹{statistics.profitTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Sales Invoiced</span>
            <span className="text-lg font-black font-mono text-slate-800 dark:text-white">{bills.length} Sheets</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sales Ledger History List: Left Side (Col 7) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span>Prescription Sales Ledger Logs</span>
            </span>
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>রিপোর্ট প্রিন্ট (Print Reports)</span>
            </button>
          </h2>

          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Bill Serial, Cashier, or Customer..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 pl-10 pr-4 py-2.5 rounded-2xl text-xs outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredBills.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs font-semibold">No sales ledger matches standard query criteria.</p>
              </div>
            ) : (
              filteredBills.map((bill) => (
                <div
                  key={bill.billNo}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-3.5 rounded-2xl space-y-2.5 hover:border-slate-200 dark:hover:border-slate-800 transition-all duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block font-mono">
                        {bill.billNo}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Patient Customer: <strong className="text-slate-600 dark:text-slate-350">{bill.customer}</strong> • {bill.date}
                      </span>
                    </div>
                    <span className="text-xs font-black font-mono text-emerald-600">
                      ₹{bill.grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900/80 text-[10px] space-y-1">
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-[8px] mb-1">Prescribed Compounded items</p>
                    {bill.items.map((it) => (
                      <div key={it.id} className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                        <span>• {it.name}</span>
                        <span>{it.qty} unit(s) @ ₹{it.sellingPrice}</span>
                      </div>
                    ))}
                    {bill.cashierName && (
                      <p className="text-[9px] text-slate-400 border-t border-slate-50 dark:border-slate-800 pt-1.5 mt-1.5 flex justify-between">
                        <span>Terminal Operator:</span>
                        <strong className="text-slate-600 dark:text-slate-300 uppercase font-mono">{bill.cashierName}</strong>
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Medicine Return Dashboard widget: Right Side (Col 5) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-105 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
              <Undo2 className="w-4 h-4 text-emerald-500" />
              <span>Record Drug Return Form</span>
            </h2>

            {success && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400 rounded-2xl text-xs font-semibold">
                {success}
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 text-rose-800 dark:text-rose-450 rounded-2xl text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1">Receipt Invoice ID *</label>
                <input
                  type="text"
                  required
                  value={returnBillNo}
                  onChange={(e) => setReturnBillNo(e.target.value)}
                  placeholder="e.g. MC-2101"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1">Select Medicine Compound *</label>
                <select
                  required
                  value={returnMedId}
                  onChange={(e) => setReturnMedId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-300"
                >
                  <option value="">-- Choose Returned Drug SKU --</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.company}) [stock: {m.stock}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1">Refund Return Quantity *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 5"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 font-mono font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-lg hover:shadow-emerald-600/10 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{loading ? "Processing Refund..." : "Verify Return Sheet"}</span>
              </button>
            </form>
          </div>

          {/* Displays recent returned logs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              <span>Recent Refund Tracking Stream</span>
            </h3>
            
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 text-[10px]">
              {returnsHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  No return records tracked.
                </div>
              ) : (
                returnsHistory.map(log => (
                  <div key={log.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-2.5 rounded-xl flex justify-between items-center">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300 block">{log.medName}</strong>
                      <span className="text-slate-400">Bill Serial: {log.billNo} • Qty: <strong>{log.qty} u</strong></span>
                    </div>
                    <span className="text-slate-400 text-[9px] font-mono">{log.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Ledger Print & Reports Overlay Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-5 my-8">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Printer className="w-5 h-5 text-emerald-500" />
                  <span>লেনদেন ও খতিয়ান রিপোর্ট প্রিন্ট ডেস্ক (Ledger Reports Desk)</span>
                </h3>
                <p className="text-xs text-slate-500">Generate high-contrast printed sheets of medical accounts and transaction sheets</p>
              </div>
              
              {/* Type Selectors */}
              <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setLedgerReportType('sales')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    ledgerReportType === 'sales'
                      ? 'bg-slate-900 dark:bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Gross Sales Ledger (বিক্রয় বিবরণী)
                </button>
                <button
                  onClick={() => setLedgerReportType('cashier')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    ledgerReportType === 'cashier'
                      ? 'bg-slate-900 dark:bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Operator Performance (অপারেটর ট্যালি)
                </button>
                <button
                  onClick={() => setLedgerReportType('pnl')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    ledgerReportType === 'pnl'
                      ? 'bg-slate-900 dark:bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Margins Statement (লাভ-ক্ষতি খতিয়ান)
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
                    <p className="text-[10px] text-slate-650">OFFICIAL PRESCRIPTION LEDGER FINANCIAL STATEMENT</p>
                  </div>
                  <div className="text-right text-[10px] space-y-1">
                    <p><strong>Report Date:</strong> <span className="font-mono">{new Date().toLocaleDateString()}</span></p>
                    <p><strong>Sector:</strong> <span className="uppercase font-bold text-slate-700">Accounts & Ledgers</span></p>
                    <p><strong>Layout:</strong> <span className="uppercase font-bold text-emerald-600">
                      {ledgerReportType === 'sales' ? '🧾 Sales Transactions Sheet' : 
                       ledgerReportType === 'cashier' ? '👥 Cashier Performance Ledger' : '📈 Margin Profit Analysis'}
                    </span></p>
                  </div>
                </div>

                {/* Report Content Switcher */}
                {ledgerReportType === 'sales' && (
                  <div className="space-y-4">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider">
                          <th className="py-2">Bill Serial</th>
                          <th className="py-2">Date filed</th>
                          <th className="py-2">Patient name</th>
                          <th className="py-2">Terminal Cashier</th>
                          <th className="py-2 text-right">Subtotal Gross</th>
                          <th className="py-2 text-right">Deductions</th>
                          <th className="py-2 text-right font-bold">Net Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {bills.map((b) => (
                          <tr key={b.billNo} className="hover:bg-slate-100 text-slate-800">
                            <td className="py-2 font-mono font-bold">{b.billNo}</td>
                            <td className="py-2 font-mono text-slate-500">{b.date}</td>
                            <td className="py-2 text-slate-855 font-bold">{b.customer}</td>
                            <td className="py-2 text-slate-500 uppercase font-mono">{b.cashierName || 'SYSTEM'}</td>
                            <td className="py-2 text-right font-mono">₹{b.subtotal.toFixed(2)}</td>
                            <td className="py-2 text-right font-mono text-amber-600">-₹{b.discountVal.toFixed(2)}</td>
                            <td className="py-2 text-right font-mono font-black text-slate-900">₹{b.grandTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-900 font-black text-slate-900 text-xs text-right">
                          <td colSpan={4} className="py-3 text-left">Aggregated Gross Turnover SUMMARY:</td>
                          <td className="py-3">₹{bills.reduce((acc, current) => acc + current.subtotal, 0).toFixed(2)}</td>
                          <td className="py-3 text-amber-600">-₹{bills.reduce((acc, current) => acc + current.discountVal, 0).toFixed(2)}</td>
                          <td className="py-3 text-emerald-600">₹{bills.reduce((acc, current) => acc + current.grandTotal, 0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {ledgerReportType === 'cashier' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-600">
                      👥 <strong>কাউন্টার অপারেটর ভিত্তিক বিক্রয় বিভাজন (Cashier performance analysis):</strong> Summary of generated cashier invoices, sheets processed, and performance details.
                    </div>
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-widest text-[9px]">
                          <th className="py-2">Operator Username</th>
                          <th className="py-2 text-center">Invoiced sheets</th>
                          <th className="py-2 text-right">Gross volume sale</th>
                          <th className="py-2 text-right">Offered discounts</th>
                          <th className="py-2 text-right font-bold">Total revenue collected (₹)</th>
                          <th className="py-2 text-right">Average invoice size (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.from(new Set(bills.map(b => b.cashierName || 'anonymous'))).map((operator) => {
                          const cashierBills = bills.filter(b => (b.cashierName || 'anonymous') === operator);
                          const gross = cashierBills.reduce((acc, curr) => acc + curr.subtotal, 0);
                          const discounts = cashierBills.reduce((acc, curr) => acc + curr.discountVal, 0);
                          const netsCollected = cashierBills.reduce((acc, curr) => acc + curr.grandTotal, 0);
                          const averageInvoice = netsCollected / (cashierBills.length || 1);

                          return (
                            <tr key={operator} className="text-slate-800 text-[10px]">
                              <td className="py-2 font-bold capitalize text-slate-900">{operator}</td>
                              <td className="py-2 text-center font-mono font-bold text-slate-600">{cashierBills.length} units</td>
                              <td className="py-2 text-right font-mono text-slate-500">₹{gross.toFixed(2)}</td>
                              <td className="py-2 text-right font-mono text-amber-650">-₹{discounts.toFixed(2)}</td>
                              <td className="py-2 text-right font-mono font-black text-emerald-650">₹{netsCollected.toFixed(2)}</td>
                              <td className="py-2 text-right font-mono">₹{averageInvoice.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {ledgerReportType === 'pnl' && (
                  <div className="space-y-5">
                    <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 text-[10px] text-indigo-900 leading-relaxed font-medium">
                      📈 <strong>সিস্টেম লাভ-ক্ষতি ও উপার্জন হিসাব বিবরণী (Estimates):</strong> Purchase costs values are calculated matching current stock records unit margins (Buying rates vs Selling rates metrics). This does not include overhead operational taxes or real-time shelf depreciation value.
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Financial Statement breakdown */}
                      <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[9px] border-b border-slate-100 pb-1">Earnings and cost parameters:</h4>
                        <div className="space-y-2 text-[10px]">
                          <div className="flex justify-between text-slate-600">
                            <span>Total Gross Invoiced billing scope:</span>
                            <span className="font-mono text-slate-700">₹{bills.reduce((acc, curr) => acc + curr.subtotal, 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-amber-650">
                            <span>Promotions offered (Discounts):</span>
                            <span className="font-mono">-₹{bills.reduce((acc, curr) => acc + curr.discountVal, 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 border-b border-dashed border-slate-100 pb-2">
                            <span>Real Cash Volume Intake:</span>
                            <span className="font-mono text-slate-800 font-bold">₹{bills.reduce((acc, curr) => acc + curr.grandTotal, 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-605">
                            <span>Estimated Stock-in Cost (COGS):</span>
                            <span className="font-mono text-slate-850">
                              ₹{(bills.reduce((acc, curr) => acc + curr.grandTotal, 0) - statistics.profitTotal).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-emerald-600 font-black text-xs pt-1 border-t border-slate-200">
                            <span>Calculated NET Margin Surplus:</span>
                            <span className="font-mono">₹{statistics.profitTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Analytical Performance index */}
                      <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                        <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[9px] border-b border-slate-100 pb-1">Key financial indices:</h4>
                        <div className="space-y-2 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Turnover Efficiency Rate:</span>
                            <strong className="text-indigo-600">100.0% Cloud Ingress</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-semibold">Average Net Profit Margin:</span>
                            <strong className="text-emerald-600">
                              {((statistics.profitTotal / (bills.reduce((acc, curr) => acc + curr.grandTotal, 0) || 1)) * 105).toFixed(1)}% Yield Ratio
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Gross Refunded Items Pulled:</span>
                            <strong className="text-rose-650">{medicines.reduce((acc, curr) => acc + (curr.stock === 0 ? 1 : 0), 0)} drug SKUs</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verification Sign off */}
                <div className="grid grid-cols-2 gap-8 pt-10 text-[10px] text-slate-400 border-t border-slate-100">
                  <div className="text-center pt-4 border-t border-dashed border-slate-200">
                    <p className="font-bold text-slate-600">Chief Accountant Endorse</p>
                    <p className="text-[8px]">Signature with registration seal</p>
                  </div>
                  <div className="text-center pt-4 border-t border-dashed border-slate-200">
                    <p className="font-bold text-slate-600">Audit Verification Committee</p>
                    <p className="text-[8px] font-mono">Issued via Iqbal Drug House audit node</p>
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
                Close Report panel
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
