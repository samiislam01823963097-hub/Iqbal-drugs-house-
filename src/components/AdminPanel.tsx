import { useState, useEffect, FormEvent } from 'react';
import { Medicine, UserRole, UserAccount } from '../types';
import { API } from '../services/api';
import { Pill, AlertTriangle, ShieldCheck, Plus, Trash2, Edit2, Lock, Tag, DollarSign, Building, Database, Users, Key } from 'lucide-react';

interface AdminPanelProps {
  medicines: Medicine[];
  onRefresh: () => Promise<void>;
  userRole: UserRole;
}

export default function AdminPanel({ medicines, onRefresh, userRole }: AdminPanelProps) {
  // Input fields for adding new drugs
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [salt, setSalt] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [stock, setStock] = useState<number | ''>('');
  const [expiry, setExpiry] = useState('');
  const [shelf, setShelf] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);

  // Status banners
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // User Accounts administration state
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');
  
  // Password override state
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [overridePassword, setOverridePassword] = useState('');

  const loadUsersList = async () => {
    try {
      const allUsers = await API.getUsers();
      setUsersList(allUsers);
    } catch (err: any) {
      console.error("Failed to load user list from database.", err);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      loadUsersList();
    }
  }, [userRole]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPassword.trim()) {
      showError("Username and Password are mandatory fields.");
      return;
    }
    
    // Check key conflicts
    const lowerName = newUsername.trim().toLowerCase();
    if (usersList.some(u => u.username.toLowerCase() === lowerName)) {
      showError("An operator with this username already exists. Choose a unique name.");
      return;
    }

    try {
      setLoading(true);
      await API.addUser({
        username: lowerName,
        password: newUserPassword.trim(),
        role: newUserRole
      });
      showSuccess(`Operative account '${newUsername}' registered successfully!`);
      setNewUsername('');
      setNewUserPassword('');
      await loadUsersList();
    } catch (err: any) {
      showError(err.message || "Failed to finalize database records.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (username: string) => {
    if (!overridePassword.trim()) {
      showError("Please enter a valid new password first.");
      return;
    }
    try {
      setLoading(true);
      await API.updateUser(username, { password: overridePassword.trim() });
      showSuccess(`Password changed successfully for operator '${username}'!`);
      setEditingUser(null);
      setOverridePassword('');
      await loadUsersList();
    } catch (err: any) {
      showError(err.message || "Failed to update security credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username.toLowerCase() === 'admin') {
      showError("The master administrator account cannot be deleted.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete operator account '${username}'?`)) {
      return;
    }
    try {
      setLoading(true);
      await API.deleteUser(username);
      showSuccess(`Deleted operator '${username}' successfully.`);
      await loadUsersList();
    } catch (err: any) {
      showError(err.message || "Deletion failed.");
    } finally {
      setLoading(false);
    }
  };

  // Authorization banner check
  if (userRole !== 'admin') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-sm space-y-4">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center text-rose-500 mx-auto shadow-inner animate-bounce">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Portal Security Gate</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This system administrative panel is strictly restricted. Only logged-in master <strong>Store Admins</strong> can interact with product creation, base values adjustments, or batch deletion.
        </p>
        <div className="text-[10px] bg-rose-50 dark:bg-rose-950/25 px-4 py-2 border border-rose-100 rounded-xl inline-block text-rose-700 dark:text-rose-450 font-bold uppercase tracking-widest font-mono">
          Security Alert: Restricted Action Blocked
        </div>
      </div>
    );
  }

  // Clear states helpers
  const clearForm = () => {
    setName('');
    setCompany('');
    setSalt('');
    setPurchasePrice('');
    setSellingPrice('');
    setStock('');
    setExpiry('');
    setShelf('');
    setEditingId(null);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3500);
  };

  // Add Medicine Form submit
  const handleAddMedicine = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim() || !sellingPrice) {
      showError("Drug name, brand company, and selling price are mandatory.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        company: company.trim(),
        salt: salt.trim() || "Generic Compound",
        purchasePrice: Number(purchasePrice) || Number(sellingPrice) * 0.7,
        sellingPrice: Number(sellingPrice),
        stock: Number(stock) || 0,
        expiry: expiry || "",
        shelf: shelf.trim() || "Rack E-1"
      };

      if (editingId) {
        // Edit update
        await API.updateMedicine(editingId, payload);
        showSuccess(`Medicinal item '${payload.name}' updated successfully!`);
      } else {
        // Create new
        const newMed = await API.addMedicine(payload);
        showSuccess(`Medicinal item '${newMed.name}' registered successfully under database ID: ${newMed.id}!`);
      }

      clearForm();
      await onRefresh();
    } catch (err: any) {
      showError(err.message || "Failed to finalize database records.");
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill fields for editing
  const handleStartEdit = (med: Medicine) => {
    setEditingId(med.id);
    setName(med.name);
    setCompany(med.company);
    setSalt(med.salt);
    setPurchasePrice(med.purchasePrice);
    setSellingPrice(med.sellingPrice);
    setStock(med.stock);
    setExpiry(med.expiry);
    setShelf(med.shelf || '');
    
    // Jump scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Permanent Delete trigger
  const handleDeleteMed = async (id: number, medName: string) => {
    if (!window.confirm(`Are you completely sure you want to permanently delete '${medName}' from all database listings? This action is irreversible.`)) {
      return;
    }

    try {
      await API.deleteMedicine(id);
      showSuccess(`Successfully removed '${medName}' from the database.`);
      await onRefresh();
    } catch (err: any) {
      showError(err.message || "Removal failed.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Form Input fields card: Col 5 */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold">
            <Pill className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>{editingId ? "Edit Medical Record" : "Add New Drug Compound"}</span>
          </span>
          <span className="text-[9px] bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-full text-slate-500 font-bold uppercase tracking-wider">
            {editingId ? "Updating Mode" : "Catalog Creation"}
          </span>
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

        <form onSubmit={handleAddMedicine} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Commercial Product Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paracetamol 500mg, Rivotril, Napa, Dolo"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Company / Brand *</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Beximco, Square, Renata"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Active Ingredient (Salt)</label>
              <input
                type="text"
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                placeholder="Paracetamol, Cetirizine"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Cost Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="₹22.00"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Sale Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="₹30.00"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Initial Qty</label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 150"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Batch Expiry Date</label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Shelf Locator / Rack</label>
              <input
                type="text"
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                placeholder="Rack B-1"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={clearForm}
                className="border border-slate-250 font-bold px-4 rounded-xl text-slate-500 text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-lg hover:shadow-emerald-600/10 text-xs transition-transform active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{editingId ? "Update Record" : "Save Database Record"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Catalog listing modification panel: Col 7 */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <h2 className="text-md font-bold tracking-tight text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
          <Database className="w-4 h-4 text-emerald-500" />
          <span>Registered Product Listing Catalog ({medicines.length})</span>
        </h2>

        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {medicines.map((med) => (
            <div
              key={med.id}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-3.5 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-800 transition-colors"
            >
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-900 dark:text-white block">{med.name}</span>
                <span className="text-[10px] text-slate-400 block capitalize">
                  Co: {med.company} • Active: {med.salt} • Shelf: {med.shelf || 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Buy Value: <strong className="font-mono text-slate-700 dark:text-slate-350">₹{med.purchasePrice.toFixed(2)}</strong> | Sale Value: <strong className="font-mono text-emerald-600">₹{med.sellingPrice.toFixed(2)}</strong> | Stock: <strong>{med.stock}</strong>
                </span>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => handleStartEdit(med)}
                  className="bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-slate-500 dark:text-slate-450 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer"
                  title="Modify Entry"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteMed(med.id, med.name)}
                  className="bg-white hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                  title="Remove SKU Item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Accounts & Operators Management panel */}
      <div className="lg:col-span-12 mt-6 border-t border-slate-100 dark:border-slate-800/80 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Sub-Card: Add User Account */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold tracking-tight text-slate-850 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <span>নতুন অপারেটর অ্যাকাউন্ট তৈরি করুন (Register Operator)</span>
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">অপারেটর ইউজারনেম / Username *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. cashier_new, stock_operator"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">পাসওয়ার্ড / Password *</label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="e.g. secure1234"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">অপারেটর রোল / Operator Role *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="cashier">ক্যাশিয়ার / Cashier Portal</option>
                  <option value="stock_manager">স্টক ম্যানেজার / Stock Manager</option>
                  <option value="admin">সিস্টেম এডমিন / Admin Access</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow transition-colors cursor-pointer text-xs"
              >
                {loading ? 'প্রসেসিং হচ্ছে...' : 'অপারেটর অ্যাকাউন্ট সেভ করুন'}
              </button>
            </form>
          </div>

          {/* Right Sub-Card: Current Users list & credential updater */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold tracking-tight text-slate-850 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Key className="w-4 h-4 text-emerald-500" />
              <span>পাসওয়ার্ড ও অ্যাকাউন্ট কাস্টমাইজেশন (Manage Credentials)</span>
            </h3>
            <div className="space-y-3 max-h-[295px] overflow-y-auto pr-1">
              {usersList.map((user) => (
                <div key={user.username} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-3 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white capitalize text-xs">{user.username}</span>
                      <span className="ml-2 text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-350 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                        {user.role === 'admin' ? 'এডমিন (Admin)' : user.role === 'cashier' ? 'ক্যাশিয়ার (Cashier)' : 'স্টক ম্যানেজার (Stock)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingUser(user.username);
                          setOverridePassword(user.password || '');
                        }}
                        className="bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 py-1 px-2.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        পাসওয়ার্ড পরিবর্তন করুন
                      </button>
                      {user.username.toLowerCase() !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.username)}
                          className="text-[10px] hover:text-rose-500 font-bold text-slate-400 p-1 cursor-pointer"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingUser === user.username && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl flex gap-2 items-center">
                      <input
                        type="text"
                        value={overridePassword}
                        onChange={(e) => setOverridePassword(e.target.value)}
                        placeholder="নতুন পাসওয়ার্ড টাইপ করুন..."
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2.5 outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                      />
                      <button
                        onClick={() => handleUpdatePassword(user.username)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded-lg text-[10px] cursor-pointer"
                      >
                        সংরক্ষণ করুন
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="text-slate-400 hover:text-slate-600 text-[10px] font-semibold cursor-pointer"
                      >
                        বাতিল
                      </button>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 flex justify-between font-mono">
                    <span>অ্যাক্টিভ পাসওয়ার্ড: <span className="font-bold text-slate-700 dark:text-slate-300">{user.password}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
