import { useState, useMemo, FormEvent } from 'react';
import { Medicine, Order, UserRole } from '../types';
import { API } from '../services/api';
import { ClipboardList, Plus, Truck, Calendar, Tag, Building, Search, ArrowRight, CheckCircle, XCircle, Printer } from 'lucide-react';

interface OrdersPanelProps {
  medicines: Medicine[];
  orders: Order[];
  onRefresh: () => Promise<void>;
  userRole: UserRole;
}

export default function OrdersPanel({ medicines, orders, onRefresh, userRole }: OrdersPanelProps) {
  // Input fields
  const [selectedMedId, setSelectedMedId] = useState<number | ''>('');
  const [qty, setQty] = useState<number | ''>('');
  const [supplier, setSupplier] = useState('');
  const [expectedDate, setExpectedDate] = useState('');

  // Print system states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);

  // Status logs
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  const handleSubmitOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (userRole === 'cashier') {
      showError("Unauthorized action: cashiers are not authorized to deploy wholesale purchase orders.");
      return;
    }

    if (!selectedMedId || !qty || qty <= 0 || !supplier.trim()) {
      showError("Please pick a compound, indicate ordering quantity, and input supplier name.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const med = medicines.find(m => m.id === Number(selectedMedId));
      if (!med) {
        showError("The selected medicine is invalid.");
        setLoading(false);
        return;
      }

      const payload = {
        medId: Number(selectedMedId),
        medName: med.name,
        qty: Number(qty),
        supplier: supplier.trim(),
        expectedDate: expectedDate || new Date().toISOString().split('T')[0]
      };

      await API.createOrder(payload);
      showSuccess("Purchase order registered in system catalog successfully!");
      
      // Clear inputs
      setSelectedMedId('');
      setQty('');
      setSupplier('');
      setExpectedDate('');

      await onRefresh();
    } catch (err: any) {
      showError(err.message || "Failed to issue purchase order.");
    } finally {
      setLoading(false);
    }
  };

  // Mark Received Stock
  const handleMarkReceived = async (orderId: string) => {
    try {
      await API.updateOrder(orderId, 'Received');
      showSuccess("Wholesale order package arrived! Medicine stock levels updated.");
      await onRefresh();
    } catch (err: any) {
      showError(err.message || "Arriving verification failed.");
    }
  };

  // Mark Cancelled
  const handleCancelOrder = async (orderId: string) => {
    try {
      await API.updateOrder(orderId, 'Cancelled');
      showSuccess("Order deployment marked cancelled.");
      await onRefresh();
    } catch (err: any) {
      showError(err.message || "Cancellation failed.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Create Order Card: Col 5 */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-emerald-500 animate-bounce" />
          <span>Deploy Wholesale Order Form</span>
        </h2>

        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400 rounded-2xl text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 text-rose-800 dark:text-rose-450 rounded-2xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1">Pick Medicine SKU Compounds *</label>
            <select
              required
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={userRole === 'cashier'}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-slate-300 cursor-pointer"
            >
              <option value="">-- Choose Compound product --</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} [Co: {m.company} • Stock: {m.stock}]
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1">Quantity (Units) *</label>
              <input
                type="number"
                required
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={userRole === 'cashier'}
                placeholder="e.g. 500"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1">Target Supplier *</label>
              <input
                type="text"
                required
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                disabled={userRole === 'cashier'}
                placeholder="e.g. Incepta Co Ltd"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-bold mb-1">Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              disabled={userRole === 'cashier'}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-slate-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading || userRole === 'cashier'}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-lg hover:shadow-emerald-600/15 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{loading ? "Ordering..." : "Deploy Wholesale Contract"}</span>
          </button>
        </form>
      </div>

       {/* Orders Tracking Stream: Col 7 */}
       <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
         <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
           <span className="flex items-center gap-1.5">
             <ClipboardList className="w-4 h-4 text-emerald-500" />
             <span>Purchase Contract Tracker Listing ({orders.length})</span>
           </span>
           <button
             onClick={() => {
               setSelectedOrderForPrint(null);
               setIsPrintModalOpen(true);
             }}
             className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-sm"
           >
             <Printer className="w-3.5 h-3.5 text-emerald-400" />
             <span>রিমোট অর্ডার শিট (Print Ledger)</span>
           </button>
         </h2>

        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No orders deployed yet.
            </div>
          ) : (
            orders.map((o) => {
              const isPending = o.status === 'Pending';
              const isReceived = o.status === 'Received';
              const isCancelled = o.status === 'Cancelled';

              return (
                <div
                  key={o.id}
                  className={`border p-3.5 rounded-2xl space-y-2.5 transition-all ${
                    isPending
                      ? 'bg-amber-50/10 border-amber-100/60 dark:border-amber-900/30'
                      : isReceived
                      ? 'bg-emerald-50/5 border-emerald-100/50 dark:border-emerald-900/30'
                      : 'bg-slate-50/50 dark:bg-slate-950 border-slate-100 dark:border-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block font-mono">
                        {o.id}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Drug SKU: <strong className="text-slate-700 dark:text-slate-350">{o.medName}</strong> • {o.createdAt}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md border ${
                        isPending
                          ? 'bg-amber-50 border-amber-200 text-amber-600'
                          : isReceived
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                          : 'bg-rose-50 border-rose-200 text-rose-600'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-400 bg-white/40 dark:bg-slate-950/40 p-2 rounded-xl">
                    <span>Supplier: <strong className="text-slate-600 dark:text-slate-350">{o.supplier}</strong></span>
                    <span>Order Balance: <strong className="text-indigo-600 dark:text-indigo-400">{o.qty} units</strong></span>
                    <span>Expected: <strong>{o.expectedDate}</strong></span>
                  </div>

                  {isReceived && (
                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Received on {o.receivedDate}</span>
                    </div>
                  )}

                  {/* Print and Actions row */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-50 dark:border-slate-800/80 mt-2">
                    <span className="text-[10px] text-slate-400">Dispatch logistics sheets</span>
                    <button
                      onClick={() => {
                        setSelectedOrderForPrint(o);
                        setIsPrintModalOpen(true);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-655 dark:text-slate-300 font-bold px-2.5 py-1.5 rounded-xl text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Printer className="w-3 h-3 text-emerald-500" />
                      <span>PO চুক্তি পত্র প্রিন্ট (Print PO Contract)</span>
                    </button>
                  </div>

                  {/* Operational triggers for Pending items & authorized users */}
                  {isPending && userRole !== 'cashier' && (
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => handleCancelOrder(o.id)}
                        className="bg-zinc-100 hover:bg-rose-500 hover:text-white dark:bg-slate-800 text-slate-600 dark:text-slate-350 p-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Order</span>
                      </button>
                      <button
                        onClick={() => handleMarkReceived(o.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-600/10"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Verify Shipment Arrival</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* Print Orders Document Modal Overlay */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto w-full">
          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-5 my-8 text-xs text-slate-950">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-md font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Printer className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
                  <span>সরবরাহকারী ক্রয় আদেশ প্রিন্ট ডেবিক (Procurement Contract Desk)</span>
                </h3>
                <p className="text-[11px] text-slate-400">Generate high contrast formal papers for wholesale pharma suppliers</p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Printable Area Wrapper */}
            <div className="border border-slate-200 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 max-h-[460px] overflow-y-auto">
              <div className="bg-white p-6 border border-slate-200 rounded-3xl space-y-6 shadow-sm print-target print:border-none print:shadow-none print:p-0 text-slate-900 mx-auto max-w-2xl">
                
                {/* Print Invoice Address */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Iqbal Drug House</h2>
                    <p className="text-[9px] text-slate-500">Chowdhury Super Market, Dhaka Road, Bangladesh</p>
                    <p className="text-[9px] text-slate-550">Contact: logistics@iqbaldrughouse.com • Mob: +880-1711100222</p>
                  </div>
                  <div className="text-right text-[10px] space-y-0.5 text-slate-700">
                    <p><strong>Print Stamp:</strong> {new Date().toLocaleDateString()}</p>
                    <p><strong>Terminal:</strong> ADMIN LOGISTICS SEC-03</p>
                    <p className="text-emerald-600 font-bold">WHOLESALE PROCUREMENT</p>
                  </div>
                </div>

                {selectedOrderForPrint ? (
                  /* Single Formal PO Contract Sheet structure */
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-md font-black uppercase tracking-widest text-slate-850 border-b border-slate-150 pb-1.5">PURCHASE ORDER CONTRACT AGREEMENT</h3>
                      <p className="text-[10px] text-slate-500">PO NO: <strong className="font-mono text-slate-800">{selectedOrderForPrint.id}</strong> • DATE: <strong className="font-mono">{selectedOrderForPrint.createdAt}</strong></p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] border border-slate-100 p-3 rounded-2xl bg-slate-50/50">
                      <div>
                        <span className="block text-slate-400 uppercase font-bold text-[8px] tracking-wider">ORDERED BY (Client):</span>
                        <strong className="text-slate-800 font-sans">Iqbal Drug House Co. Ltd</strong>
                        <p className="text-slate-500">Dhaka Road Depot Node 3, Bangladesh</p>
                      </div>
                      <div>
                        <span className="block text-slate-400 uppercase font-bold text-[8px] tracking-wider">ORDERED TO (Supplier Vendor):</span>
                        <strong className="text-slate-800 font-sans">{selectedOrderForPrint.supplier}</strong>
                        <p className="text-slate-500">Wholesale Pharma Supply Division</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="font-bold uppercase tracking-wider text-[8px] text-slate-400">Order inventory specification item details:</p>
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="border-b-2 border-slate-200 text-slate-500 uppercase">
                            <th className="py-2">Compound Brand SKU</th>
                            <th className="py-2">System reference ID</th>
                            <th className="py-2 text-right">Unit Bulk Count</th>
                            <th className="py-2 text-right">Est. Unit Price</th>
                            <th className="py-2 text-right font-black">Contract Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100 text-slate-800 font-medium">
                            <td className="py-3 font-bold text-slate-900">{selectedOrderForPrint.medName}</td>
                            <td className="py-3 font-mono text-slate-400">MED-{selectedOrderForPrint.medId}</td>
                            <td className="py-3 text-right font-mono font-bold">{selectedOrderForPrint.qty} units</td>
                            <td className="py-3 text-right font-mono">₹${(medicines.find(m => m.id === selectedOrderForPrint.medId)?.purchasePrice || 0).toFixed(2)}</td>
                            <td className="py-3 text-right font-mono font-black text-slate-900">
                              ₹{((medicines.find(m => m.id === selectedOrderForPrint.medId)?.purchasePrice || 1.5) * selectedOrderForPrint.qty).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2 text-[9px] text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
                      <p className="font-bold text-slate-650">CONTRACT LEGAL TERMS & DISPATCH PRINCIPLES:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>The wholesale supplier agrees to deliver the active medical stocks within the expected target date of <strong className="text-slate-800 font-mono">{selectedOrderForPrint.expectedDate}</strong>.</li>
                        <li>Medicinal batch packages must retain more than 18 months shelf expiration levels upon dock entry verification.</li>
                        <li>This purchase order conforms strictly to Bangladeshi drug regulation standards.</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  /* Multiple order manifest logging ledger */
                  <div className="space-y-4">
                    <div className="text-center font-black uppercase text-slate-800 tracking-wider">
                      WHOLESALE PROCUREMENT ORDERS MASTER LOG
                    </div>
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-widest text-[8px]">
                          <th className="py-2">Contract ID</th>
                          <th className="py-2">Date filed</th>
                          <th className="py-2">Target supplier</th>
                          <th className="py-2">Ordered Drug</th>
                          <th className="py-2 text-right">Wholesale Qty</th>
                          <th className="py-2 text-center">Expected Date</th>
                          <th className="py-2 text-center">Operational Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="py-2.5 font-mono font-bold text-slate-900">{o.id}</td>
                            <td className="py-2.5 font-mono text-slate-500">{o.createdAt}</td>
                            <td className="py-2.5 capitalize">{o.supplier}</td>
                            <td className="py-2.5 font-bold text-indigo-950">{o.medName}</td>
                            <td className="py-2.5 text-right font-mono font-bold">{o.qty} units</td>
                            <td className="py-2.5 text-center font-mono">{o.expectedDate}</td>
                            <td className="py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold ${
                                o.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                o.status === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Verification Sign off */}
                <div className="grid grid-cols-2 gap-8 pt-10 text-[10px] text-slate-400 border-t border-slate-100">
                  <div className="text-center pt-4 border-t border-dashed border-slate-200">
                    <p className="font-bold text-slate-600">Issued by Procurement Officer</p>
                    <p className="text-[8px]">Signature with timestamp seal</p>
                  </div>
                  <div className="text-center pt-4 border-t border-dashed border-slate-200">
                    <p className="font-bold text-slate-600">Acknowledged by Supplier Representative</p>
                    <p className="text-[8px] font-mono">Supplier Authorized signature sign-off</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex justify-end gap-3.5 pt-2">
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
                className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition-all tracking-tight flex items-center gap-1.5 cursor-pointer shadow-lg shadow-slate-900/10"
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
