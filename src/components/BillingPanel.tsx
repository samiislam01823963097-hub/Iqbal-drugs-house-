import { useState, useMemo } from 'react';
import { Medicine, CartItem, Bill } from '../types';
import { API } from '../services/api';
import { Search, ShoppingCart, Percent, Trash2, Printer, Plus, Minus, Check, Sparkles, User, ReceiptText } from 'lucide-react';

interface BillingPanelProps {
  medicines: Medicine[];
  onRefresh: () => Promise<void>;
  cashierName: string;
}

export default function BillingPanel({ medicines, onRefresh, cashierName }: BillingPanelProps) {
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeds, setSelectedMeds] = useState<Set<number>>(new Set());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(5);
  const [customerName, setCustomerName] = useState('');
  const [activeAltSalt, setActiveAltSalt] = useState<string | null>(null);
  
  // Invoice state
  const [currentInvoice, setCurrentInvoice] = useState<Bill | null>(null);
  const [invoiceCopyType, setInvoiceCopyType] = useState<'customer' | 'shop'>('customer');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter medicines based on search
  const filteredMeds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return medicines.slice(0, 24);
    
    // Fuzzy/Direct Search by name, company, or salt
    return medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        m.salt.toLowerCase().includes(q)
    );
  }, [searchQuery, medicines]);

  // Handle Multi-Select (Bulk Actions)
  const toggleSelectMed = (id: number) => {
    const next = new Set(selectedMeds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMeds(next);

    // Also update active salt to show alternatives dynamically
    const med = medicines.find(m => m.id === id);
    if (med && med.salt) {
      setActiveAltSalt(med.salt);
    }
  };

  const handleBulkAdd = () => {
    if (selectedMeds.size === 0) return;
    
    let addedCount = 0;
    const nextCart = [...cart];

    selectedMeds.forEach((id) => {
      const med = medicines.find((m) => m.id === id);
      if (!med || med.stock <= 0) return;
      
      // Expiry Guard
      if (med.expiry && new Date(med.expiry) < new Date()) return;

      const existing = nextCart.find((item) => item.id === id);
      if (existing) {
        if (existing.qty < med.stock) {
          existing.qty += 1;
          addedCount++;
        }
      } else {
        nextCart.push({ ...med, qty: 1 });
        addedCount++;
      }
    });

    setCart(nextCart);
    setSelectedMeds(new Set());
    if (addedCount > 0) {
      showSuccess(`Added ${addedCount} medicine(s) to the cart.`);
    } else {
      showError("Selected item(s) are either out of stock or expired.");
    }
  };

  // Cart operations
  const addToCartIndex = (med: Medicine, qty: number = 1) => {
    if (med.stock <= 0) {
      showError("Out of Stock.");
      return;
    }
    if (med.expiry && new Date(med.expiry) < new Date()) {
      showError("This medicine has expired.");
      return;
    }

    const nextCart = [...cart];
    const existing = nextCart.find((item) => item.id === med.id);

    if (existing) {
      const potential = existing.qty + qty;
      if (potential > med.stock) {
        showError(`Only ${med.stock} units available in stock.`);
        return;
      }
      existing.qty = potential;
    } else {
      nextCart.push({ ...med, qty });
    }

    setCart(nextCart);
    showSuccess(`${qty} x ${med.name} added to cart.`);
  };

  const updateCartQty = (id: number, delta: number) => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return;

    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const nextQty = item.qty + delta;
          if (nextQty <= 0) return null;
          if (nextQty > med.stock) {
            showError(`Limit reached. Only ${med.stock} items in stock.`);
            return item;
          }
          return { ...item, qty: nextQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedMeds(new Set());
  };

  // Math totals
  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.sellingPrice * item.qty, 0);
    const discountVal = subtotal * (discountPercent / 100);
    const grandTotal = subtotal - discountVal;

    return { subtotal, discountVal, grandTotal };
  }, [cart, discountPercent]);

  // Show status feedback helpers
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showError("The cart is empty. Please select medicines first.");
      return;
    }

    try {
      const payload = {
        customer: customerName.trim() || "Guest Customer",
        items: cart,
        discountPercent,
        discountVal: totals.discountVal,
        subtotal: totals.subtotal,
        grandTotal: totals.grandTotal,
        cashierName
      };

      const bill = await API.createBill(payload);
      setCurrentInvoice(bill);
      clearCart();
      setCustomerName('');
      await onRefresh();
      showSuccess(`Invoice ${bill.billNo} generated successfully!`);
    } catch (err: any) {
      showError(err.message || "Checkout failed.");
    }
  };

  // Same Salt Alternatives
  const alternatives = useMemo(() => {
    if (!activeAltSalt) return [];
    return medicines.filter(m => m.salt === activeAltSalt && m.stock > 0);
  }, [activeAltSalt, medicines]);

  // Direct Browser Printing helper
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Messages banner */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 text-rose-800 dark:text-rose-400 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Medicine Selector: Left Side (Col 7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-150 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-500" />
              <span>Smart Prescription Search</span>
            </h2>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type Name, Active Salt, or Brand Co..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-2xl py-2.5 pl-4 pr-10 text-sm outline-none transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-bold cursor-pointer transition-all active:scale-90"
                    title="Clear Search Query"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={handleBulkAdd}
                disabled={selectedMeds.size === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-600 font-semibold px-4 rounded-2xl transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bulk Add ({selectedMeds.size})</span>
              </button>
            </div>

            {/* Catalog list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredMeds.map((med) => {
                const isSelected = selectedMeds.has(med.id);
                const isLowStock = med.stock <= 10 && med.stock > 0;
                const isOutOfStock = med.stock === 0;
                const isExpired = med.expiry && new Date(med.expiry) < new Date();

                return (
                  <div
                    key={med.id}
                    onClick={() => toggleSelectMed(med.id)}
                    className={`border p-3.5 rounded-2xl flex flex-col justify-between gap-3 cursor-pointer select-none transition-all duration-200 ${
                      isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white line-clamp-1">
                          {med.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                          ₹{med.sellingPrice}
                        </span>
                      </div>
                      
                      <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 capitalize line-clamp-1 mt-0.5">
                        {med.company}
                      </div>

                      <div className="text-[10px] bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-md inline-block text-slate-500 dark:text-slate-400 mt-2 font-mono">
                        {med.salt}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2 text-[10px]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {isOutOfStock ? (
                          <span className="bg-rose-50 dark:bg-rose-950/25 border border-rose-100 dark:border-rose-900/45 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md">
                            No Stock
                          </span>
                        ) : isExpired ? (
                          <span className="bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-md font-bold">
                            Expired
                          </span>
                        ) : isLowStock ? (
                          <span className="bg-amber-50 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md">
                            Low stock: {med.stock}
                          </span>
                        ) : (
                          <span className="bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/45 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                            Stock: {med.stock}
                          </span>
                        )}
                        {med.shelf && (
                          <span className="text-slate-400 font-normal">
                            • Room {med.shelf}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCartIndex(med);
                        }}
                        disabled={isOutOfStock || isExpired}
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-950 text-white disabled:text-slate-400 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer flex-shrink-0"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Salt alternatives box */}
          {activeAltSalt && alternatives.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                  <span>Substitutes for "{activeAltSalt}" (Same ingredient)</span>
                </h3>
                <button
                  onClick={() => setActiveAltSalt(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Clear Group
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {alternatives.map(alt => (
                  <div
                    key={alt.id}
                    onClick={() => addToCartIndex(alt)}
                    className="bg-amber-50/20 dark:bg-amber-950/10 border border-amber-100/30 dark:border-amber-900/30 p-3 rounded-2xl flex items-center justify-between hover:bg-amber-50/35 cursor-pointer transition-all duration-150"
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{alt.name}</span>
                      <span className="text-[10px] text-slate-400 block">{alt.company} • Room {alt.shelf}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-amber-600 block">₹{alt.sellingPrice}</span>
                      <span className="text-[9px] text-emerald-600 font-semibold">Stock: {alt.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prescription Cart / Invoicing Panel: Right Side (Col 5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-150 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-500" />
                <span>Sales Prescription Cart</span>
              </span>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 font-bold">
                {cart.length} unique SKU
              </span>
            </h2>

            {/* Customer Information inputs */}
            <div className="grid grid-cols-1 gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Patient / Customer Name (Optional)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl text-slate-500">
                <span className="font-semibold text-slate-400 uppercase tracking-wider">Registered Cashier:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{cashierName}</span>
              </div>
            </div>

            {/* Cart listing */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <ShoppingCart className="w-10 h-10 mx-auto opacity-30 text-slate-500" />
                <p className="text-xs font-semibold">Ready to record sales prescription</p>
                <p className="text-[10px] text-slate-400">Search drugs on left and click "Add to Cart"</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 p-3 rounded-2xl flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        ₹{item.sellingPrice} • Room {item.shelf}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartQty(item.id, -1)}
                        className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.id, 1)}
                        className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[60px]">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                        ₹{(item.sellingPrice * item.qty).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Discounts and Summary Totals */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-amber-500" />
                  <span>Promo Discount (%)</span>
                </span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-1 text-center text-xs font-bold font-mono"
                />
              </div>

              <div className="text-xs space-y-2 bg-slate-50/50 dark:bg-slate-950/50 p-3 rounded-2xl">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Price</span>
                  <span className="font-mono font-semibold">₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-yellow-600 dark:text-yellow-400">
                  <span>Deduction ({discountPercent}%)</span>
                  <span className="font-mono font-semibold">-₹{totals.discountVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-800 dark:text-white font-extrabold text-sm border-t border-dashed border-slate-200 dark:border-slate-800/80 pt-2">
                  <span>Amount Due</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-md">₹{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="border border-slate-200 dark:border-slate-800 font-bold px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl shadow-lg hover:shadow-emerald-600/20 text-xs transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ReceiptText className="w-4 h-4" />
                  <span>Generate Official Receipt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Modal Overlay: Fully detailed with Shop copy vs Customer Copy */}
      {currentInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Medicinal Invoice Output</h3>
                <p className="text-[11px] text-slate-400">Print standard layout or dual-copy sheets</p>
              </div>
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200/50 dark:border-slate-800">
                <button
                  onClick={() => setInvoiceCopyType('customer')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                    invoiceCopyType === 'customer'
                      ? 'bg-slate-900 dark:bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Customer Copy
                </button>
                <button
                  onClick={() => setInvoiceCopyType('shop')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                    invoiceCopyType === 'shop'
                      ? 'bg-slate-900 dark:bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Shop Copy
                </button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div id="invoice-print-area" className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 space-y-6 relative dark:text-slate-900 print-target">
              
              {/* Copy Indicator flag (only visible in print/preview) */}
              <div className="absolute right-6 top-6 bg-slate-100 dark:bg-slate-800 dark:text-white uppercase tracking-widest text-[9px] font-black px-3 py-1 rounded-md border border-slate-200/50 dark:border-slate-700 print:bg-slate-100 print:text-black">
                {invoiceCopyType === 'customer' ? '📜 CUSTOMER DUPLICATE' : '🏪 PHARMACY SHOP ARCHIVE'}
              </div>

              {/* Header */}
              <div className="text-center space-y-1">
                <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">Iqbal Drug House</h2>
                <p className="text-[10px] text-slate-500 font-semibold">Chowdhury Super Market, Dhaka Road, Bangladesh</p>
                <p className="text-[10px] text-slate-500">Support & Emergencies Phone: +880-1711100222</p>
              </div>

              {/* Details banner */}
              <div className="grid grid-cols-2 gap-4 border-y border-dashed border-slate-200 py-3 text-[10px] text-slate-600">
                <div className="space-y-1">
                  <p><strong>Invoice Serial:</strong> <span className="font-mono text-slate-800">{currentInvoice.billNo}</span></p>
                  <p><strong>Date Filed:</strong> <span className="font-mono text-slate-800">{currentInvoice.date}</span></p>
                </div>
                <div className="space-y-1 text-right">
                  <p><strong>Customer Name:</strong> <span className="text-slate-800 uppercase font-black">{currentInvoice.customer}</span></p>
                  <p><strong>Prescribing Officer:</strong> <span className="text-slate-800 uppercase font-bold">{currentInvoice.cashierName}</span></p>
                </div>
              </div>

              {/* Invoice table */}
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="py-2">Medicine SKU Name</th>
                    <th className="py-2 text-center">Qty Bought</th>
                    <th className="py-2 text-right">Unit Rate</th>
                    <th className="py-2 text-right">Raw Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentInvoice.items.map((item) => (
                    <tr key={item.id} className="text-slate-800">
                      <td className="py-2">
                        <span className="font-bold">{item.name}</span>
                        <span className="text-[9px] text-slate-400 block font-normal capitalize">Co: {item.company} | Shelf: {item.shelf}</span>
                      </td>
                      <td className="py-2 text-center font-mono font-bold">{item.qty} u</td>
                      <td className="py-2 text-right font-mono">₹{item.sellingPrice.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono font-bold">₹{(item.sellingPrice * item.qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summaries details */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-start text-xs text-slate-600">
                <div className="max-w-[240px] space-y-1.5 text-[9px] text-slate-400">
                  <p className="font-bold text-slate-500 uppercase">System Terms & Covenants</p>
                  <p>• Goods once sold are returnable within 7 calendar days with original receipts.</p>
                  <p>• Keep all products in dry places below 30°C matching drug standard requirements.</p>
                </div>
                <div className="w-[180px] space-y-1.5 text-right font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross Sale Subtotal:</span>
                    <span className="font-mono">₹{currentInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {currentInvoice.discountPercent > 0 && (
                    <div className="flex justify-between text-yellow-600 font-bold">
                      <span>Deduction ({currentInvoice.discountPercent}%):</span>
                      <span className="font-mono">-₹{currentInvoice.discountVal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 border-t border-dashed border-slate-200 pt-2 font-black text-sm">
                    <span>Grand Paid Total:</span>
                    <span className="font-mono text-emerald-600">₹{currentInvoice.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Signature lines */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-[10px] text-slate-400 border-t border-slate-100">
                <div className="text-center pt-4 border-t border-dashed border-slate-200">
                  <p className="font-bold text-slate-600">Patient/Customer Endorse</p>
                  <p className="text-[8px] text-slate-400">Signed with seal</p>
                </div>
                <div className="text-center pt-4 border-t border-dashed border-slate-200">
                  <p className="font-bold text-slate-600">For Iqbal Drug House Authority</p>
                  <p className="text-[8px] text-slate-400 font-mono">Issued via digital system auth</p>
                </div>
              </div>
            </div>

            {/* Print controls */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setCurrentInvoice(null)}
                className="border border-slate-200 dark:border-slate-800 font-bold px-5 py-2.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs transition-colors cursor-pointer"
              >
                Close Receipt
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition-all tracking-tight flex items-center gap-1.5 cursor-pointer shadow-lg shadow-slate-900/10 dark:shadow-emerald-950/20"
              >
                <Printer className="w-4 h-4" />
                <span>Print Copy Sheet</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
