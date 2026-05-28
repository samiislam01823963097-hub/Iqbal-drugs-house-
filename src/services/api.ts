import { Medicine, Bill, Order, UserRole, UserAccount } from '../types';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  limit
} from 'firebase/firestore';

// Local storage keys for robust offline cache mechanics
const MEDICINES_CACHE_KEY = 'iqbal_cache_medicines';
const BILLS_CACHE_KEY = 'iqbal_cache_bills';
const ORDERS_CACHE_KEY = 'iqbal_cache_orders';
const PENDING_SYNC_KEY = 'iqbal_pending_syncs';
const USERS_CACHE_KEY = 'iqbal_cache_users';

export interface PendingSyncItem {
  id: string;
  type: 'ADD_MEDICINE' | 'UPDATE_MEDICINE' | 'DELETE_MEDICINE' | 'CREATE_BILL' | 'RECORD_RETURNS' | 'CREATE_ORDER' | 'UPDATE_ORDER' | 'ADD_USER' | 'UPDATE_USER' | 'DELETE_USER';
  tempId?: string | number;
  payload: any;
  timestamp: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// Global active sync callbacks
let statusCallback: ((status: { isOnline: boolean; pendingCount: number; syncing: boolean }) => void) | null = null;
let isSyncingActive = false;

// Helpers to read/write state locally
const getLocalMedicines = (): Medicine[] => {
  try {
    return JSON.parse(localStorage.getItem(MEDICINES_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setLocalMedicines = (meds: Medicine[]) => {
  localStorage.setItem(MEDICINES_CACHE_KEY, JSON.stringify(meds));
};

const getLocalBills = (): Bill[] => {
  try {
    return JSON.parse(localStorage.getItem(BILLS_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setLocalBills = (bills: Bill[]) => {
  localStorage.setItem(BILLS_CACHE_KEY, JSON.stringify(bills));
};

const getLocalOrders = (): Order[] => {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setLocalOrders = (orders: Order[]) => {
  localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(orders));
};

const getLocalUsers = (): UserAccount[] => {
  try {
    return JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setLocalUsers = (users: UserAccount[]) => {
  localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
};

const getPendingQueue = (): PendingSyncItem[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
  } catch {
    return [];
  }
};

const setPendingQueue = (queue: PendingSyncItem[]) => {
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  triggerStatusChange();
};

const triggerStatusChange = () => {
  if (statusCallback) {
    statusCallback({
      isOnline: navigator.onLine,
      pendingCount: getPendingQueue().length,
      syncing: isSyncingActive,
    });
  }
};

// Listen for network changes to inform callbacks
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    triggerStatusChange();
    API.syncPendingData().catch(console.error);
  });
  window.addEventListener('offline', () => {
    triggerStatusChange();
  });
}

// Rule Telemetry and Diagnostics Handler
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error Telemetry logged:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const API = {
  // Subscribe to connectivity and pending sync counts
  subscribeToSyncStatus(callback: (status: { isOnline: boolean; pendingCount: number; syncing: boolean }) => void) {
    statusCallback = callback;
    triggerStatusChange();
    return () => {
      statusCallback = null;
    };
  },

  // Manual isOnline check
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  // Get total pending sync queue size
  getPendingCount(): number {
    return getPendingQueue().length;
  },

  // Login Authentication (supports local validation and anonymous sign-in to secure DB operations)
  async login(username: string, password: string, role: UserRole) {
    // Establish credentials session in Firebase to activate firestore security keys
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    } catch (err) {
      console.warn("Failed to sign in anonymously to Firebase auth, proceeding with offline access", err);
    }

    const lowerUser = username.toLowerCase().trim();

    // Fetch matching user list from cache or remote
    let list: UserAccount[] = [];
    try {
      list = await this.getUsers();
    } catch {
      list = getLocalUsers();
    }

    // Default hardcoded fail-safe admin if cache is completely cleared
    if (list.length === 0) {
      list = [
        { username: 'admin', password: 'admin123', role: 'admin' },
        { username: 'cashier', password: 'cashier123', role: 'cashier' },
        { username: 'stock', password: 'stock123', role: 'stock_manager' }
      ];
    }

    // Try finding user with input username
    const foundUser = list.find(u => u.username.toLowerCase().trim() === lowerUser);

    let isValid = false;
    let finalRole = role;

    if (foundUser) {
      if (foundUser.password === password) {
        // Admin credentials can login under any role
        if (foundUser.role === 'admin') {
          isValid = true;
          finalRole = role;
        } else if (foundUser.role === role) {
          isValid = true;
        }
      }
    } else {
      // Hardcoded master admin fallback bypass
      if (lowerUser === 'admin' && password === 'admin123') {
        isValid = true;
        finalRole = role;
      }
    }

    if (isValid) {
      const session = { username: lowerUser, role: finalRole, token: `local-session-for-${username}` };
      localStorage.setItem('iqbal_user_session', JSON.stringify(session));
      return { success: true, ...session };
    } else {
      throw new Error("Invalid username/password or incorrect account role selection.");
    }
  },

  // Get Users List
  async getUsers(): Promise<UserAccount[]> {
    if (!navigator.onLine) {
      return getLocalUsers();
    }
    try {
      const colPath = 'users';
      let users: UserAccount[] = [];
      const querySnapshot = await getDocs(collection(db, colPath));
      querySnapshot.forEach((docSnap) => {
        users.push(docSnap.data() as UserAccount);
      });

      // Seeding fresh default user accounts to Firestore if empty
      if (users.length === 0) {
        console.log("Seeding fresh default user accounts to Firestore...");
        const defaultUsers: UserAccount[] = [
          { username: 'admin', password: 'admin123', role: 'admin' },
          { username: 'cashier', password: 'cashier123', role: 'cashier' },
          { username: 'stock', password: 'stock123', role: 'stock_manager' }
        ];
        for (const user of defaultUsers) {
          await setDoc(doc(db, 'users', user.username), user);
        }
        users = defaultUsers;
      }

      setLocalUsers(users);
      return users;
    } catch {
      return getLocalUsers();
    }
  },

  // Add User Account
  async addUser(user: UserAccount): Promise<UserAccount> {
    const list = getLocalUsers();
    const exists = list.some(u => u.username.toLowerCase() === user.username.toLowerCase());
    if (exists) {
      throw new Error("This username already exists.");
    }
    list.push(user);
    setLocalUsers(list);

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-add-user-${user.username}-${Date.now()}`,
        type: 'ADD_USER',
        payload: user,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return user;
    }

    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await setDoc(doc(db, 'users', user.username), user);
      return user;
    } catch (err) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-add-user-${user.username}-${Date.now()}`,
        type: 'ADD_USER',
        payload: user,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return user;
    }
  },

  // Update User Password / Role
  async updateUser(username: string, updates: Partial<UserAccount>): Promise<UserAccount> {
    const list = getLocalUsers();
    const idx = list.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    let uUser: UserAccount;
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      setLocalUsers(list);
      uUser = list[idx];
    } else {
      uUser = { username, password: '', role: 'cashier', ...updates };
    }

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-up-user-${username}-${Date.now()}`,
        type: 'UPDATE_USER',
        payload: { username, updates },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return uUser;
    }

    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await updateDoc(doc(db, 'users', username), updates);
      return uUser;
    } catch (err) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-up-user-${username}-${Date.now()}`,
        type: 'UPDATE_USER',
        payload: { username, updates },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return uUser;
    }
  },

  // Delete User doc
  async deleteUser(username: string): Promise<void> {
    if (username.toLowerCase() === 'admin') {
      throw new Error("The master admin account cannot be deleted for system safety.");
    }
    const list = getLocalUsers().filter(u => u.username.toLowerCase() !== username.toLowerCase());
    setLocalUsers(list);

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-del-user-${username}-${Date.now()}`,
        type: 'DELETE_USER',
        payload: { username },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return;
    }

    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await deleteDoc(doc(db, 'users', username));
    } catch (err) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-del-user-${username}-${Date.now()}`,
        type: 'DELETE_USER',
        payload: { username },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
    }
  },

  // Get Medicines
  async getMedicines(): Promise<Medicine[]> {
    if (!navigator.onLine) {
      return getLocalMedicines();
    }
    try {
      const colPath = 'medicines';
      let medicines: Medicine[] = [];
      try {
        const querySnapshot = await getDocs(collection(db, colPath));
        querySnapshot.forEach((docSnap) => {
          medicines.push(docSnap.data() as Medicine);
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, colPath);
      }

      // If database is completely brand new and empty, seed it with premium default stock medications!
      if (medicines.length === 0) {
        console.log("Seeding fresh default medications to Firestore...");
        const defaultMeds: Medicine[] = [
          { id: 101, name: "Paracetamol 500mg (Napa)", company: "Beximco Pharmaceuticals", salt: "Paracetamol", purchasePrice: 22.0, sellingPrice: 30.0, stock: 145, expiry: "2027-12-15", shelf: "Rack A-1" },
          { id: 102, name: "Azithromycin 250mg", company: "Square Pharmaceuticals", salt: "Azithromycin", purchasePrice: 55.0, sellingPrice: 72.0, stock: 75, expiry: "2026-12-20", shelf: "Rack B-3" },
          { id: 103, name: "Amoxicillin 500mg (Moxacil)", company: "Renata Limited", salt: "Amoxicillin", purchasePrice: 38.0, sellingPrice: 50.0, stock: 8, expiry: "2027-09-10", shelf: "Rack A-2" },
          { id: 104, name: "Cetirizine 10mg (Atova)", company: "Incepta Pharmaceuticals", salt: "Cetirizine", purchasePrice: 15.0, sellingPrice: 25.0, stock: 190, expiry: "2027-03-01", shelf: "Rack C-1" },
          { id: 105, name: "Omeprazole 20mg (Seclo)", company: "Square Pharmaceuticals", salt: "Omeprazole", purchasePrice: 42.0, sellingPrice: 58.0, stock: 3, expiry: "2026-08-30", shelf: "Rack D-2" },
          { id: 106, name: "Metformin 500mg", company: "ACI Limited", salt: "Metformin", purchasePrice: 28.0, sellingPrice: 40.0, stock: 55, expiry: "2027-07-15", shelf: "Rack E-4" },
          { id: 107, name: "Ibuprofen 400mg", company: "Opsonin Pharma", salt: "Ibuprofen", purchasePrice: 22.0, sellingPrice: 35.0, stock: 0, expiry: "2026-05-01", shelf: "Rack F-1" },
          { id: 108, name: "Dolo 650mg", company: "Micro Labs", salt: "Paracetamol", purchasePrice: 24.0, sellingPrice: 33.0, stock: 6, expiry: "2027-02-28", shelf: "Rack A-1" }
        ];
        
        for (const med of defaultMeds) {
          await setDoc(doc(db, 'medicines', String(med.id)), med);
        }
        medicines = defaultMeds;
      }

      setLocalMedicines(medicines);
      return medicines;
    } catch (err) {
      console.warn("Serving cached medicines during offline sync fallback pass", err);
      return getLocalMedicines();
    }
  },

  // Add Medicine
  async addMedicine(medicine: Omit<Medicine, 'id'>): Promise<Medicine> {
    const nextId = Date.now() % 100000 + 200;
    const newMed: Medicine = {
      ...medicine,
      id: nextId
    };

    // Optimistically cache locally first
    const meds = getLocalMedicines();
    meds.push(newMed);
    setLocalMedicines(meds);

    if (!navigator.onLine) {
      // Place in offline pending sync queue
      const queue = getPendingQueue();
      queue.push({
        id: `sync-add-med-${nextId}`,
        type: 'ADD_MEDICINE',
        tempId: nextId,
        payload: newMed,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return newMed;
    }

    const docPath = `medicines/${nextId}`;
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await setDoc(doc(db, 'medicines', String(nextId)), newMed);
      return newMed;
    } catch (err) {
      console.warn("Failed to write to remote cloud; caching actions to offline sync queue instead", err);
      const queue = getPendingQueue();
      queue.push({
        id: `sync-add-med-${nextId}`,
        type: 'ADD_MEDICINE',
        tempId: nextId,
        payload: newMed,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return newMed;
    }
  },

  // Update Medicine (Restock, Sales, Settings modifications)
  async updateMedicine(id: number, updates: Partial<Medicine>): Promise<Medicine> {
    const meds = getLocalMedicines();
    const idx = meds.findIndex(m => m.id === id);
    let updatedMed: Medicine;
    
    if (idx !== -1) {
      meds[idx] = { ...meds[idx], ...updates };
      setLocalMedicines(meds);
      updatedMed = meds[idx];
    } else {
      updatedMed = { id, name: '', company: '', salt: '', purchasePrice: 0, sellingPrice: 0, stock: 0, expiry: '', ...updates };
    }

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-up-med-${id}-${Date.now()}`,
        type: 'UPDATE_MEDICINE',
        tempId: id,
        payload: { id, updates },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return updatedMed;
    }

    const docPath = `medicines/${id}`;
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await updateDoc(doc(db, 'medicines', String(id)), updates);
      return updatedMed;
    } catch (err) {
      console.warn("Cloud write failed; queueing updates to offline cache", err);
      const queue = getPendingQueue();
      queue.push({
        id: `sync-up-med-${id}-${Date.now()}`,
        type: 'UPDATE_MEDICINE',
        tempId: id,
        payload: { id, updates },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return updatedMed;
    }
  },

  // Delete Medicine
  async deleteMedicine(id: number): Promise<void> {
    const meds = getLocalMedicines().filter(m => m.id !== id);
    setLocalMedicines(meds);

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-del-med-${id}-${Date.now()}`,
        type: 'DELETE_MEDICINE',
        tempId: id,
        payload: { id },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return;
    }

    const docPath = `medicines/${id}`;
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await deleteDoc(doc(db, 'medicines', String(id)));
    } catch (err) {
      console.warn("Delete omitted locally; queued offline pass", err);
      const queue = getPendingQueue();
      queue.push({
        id: `sync-del-med-${id}-${Date.now()}`,
        type: 'DELETE_MEDICINE',
        tempId: id,
        payload: { id },
        timestamp: Date.now()
      });
      setPendingQueue(queue);
    }
  },

  // Get Bills Ledger
  async getBills(): Promise<Bill[]> {
    if (!navigator.onLine) {
      return getLocalBills();
    }
    try {
      const colPath = 'bills';
      const bills: Bill[] = [];
      const querySnapshot = await getDocs(collection(db, colPath));
      querySnapshot.forEach((docSnap) => {
        bills.push(docSnap.data() as Bill);
      });
      // Sort reverse chronological
      bills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLocalBills(bills);
      return bills;
    } catch (err) {
      return getLocalBills();
    }
  },

  // Create Customer Sale Invoice
  async createBill(billData: Omit<Bill, 'billNo' | 'date'>): Promise<Bill> {
    const currentBillsLength = getLocalBills().length;
    const nextBillNo = `MC-${currentBillsLength + 2101}`;
    const newBill: Bill = {
      ...billData,
      billNo: nextBillNo,
      date: new Date().toISOString()
    };

    // 1. Save new Bill to Offline Caches
    const bills = getLocalBills();
    bills.unshift(newBill);
    setLocalBills(bills);

    // 2. Reduce medicine stocks locally optimistically
    const meds = getLocalMedicines();
    billData.items.forEach((item) => {
      const target = meds.find(m => m.id === item.id);
      if (target) {
        target.stock = Math.max(0, target.stock - item.qty);
      }
    });
    setLocalMedicines(meds);

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-bill-${nextBillNo}`,
        type: 'CREATE_BILL',
        payload: newBill,
        tempId: nextBillNo,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return newBill;
    }

    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      // Post invoice to Firestore
      await setDoc(doc(db, 'bills', nextBillNo), newBill);

      // Decrement master stocks on Firestore concurrently
      for (const item of billData.items) {
        const medInLocalStorage = meds.find(m => m.id === item.id);
        if (medInLocalStorage) {
          await updateDoc(doc(db, 'medicines', String(item.id)), { stock: medInLocalStorage.stock });
        }
      }

      return newBill;
    } catch (err) {
      console.warn("Firestore billing failed, fallback to offline sync queue queueing", err);
      const queue = getPendingQueue();
      queue.push({
        id: `sync-bill-${nextBillNo}`,
        type: 'CREATE_BILL',
        payload: newBill,
        tempId: nextBillNo,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return newBill;
    }
  },

  // Record Returns and restore stock levels
  async recordReturn(billNo: string, medId: number, qty: number) {
    const meds = getLocalMedicines();
    const target = meds.find(m => m.id === medId);
    let medName = "Unknown Product";
    if (target) {
      target.stock += qty;
      medName = target.name;
      setLocalMedicines(meds);
    }

    const returnId = `RET-${Date.now()}`;
    const logPayload = {
      id: returnId,
      date: new Date().toISOString(),
      billNo,
      medId,
      medName,
      qty
    };

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-return-${returnId}`,
        type: 'RECORD_RETURNS',
        payload: logPayload,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return { success: true, offline: true, message: "Returned offline successfully, queued for syncing" };
    }

    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await setDoc(doc(db, 'returns', returnId), logPayload);
      if (target) {
        await updateDoc(doc(db, 'medicines', String(medId)), { stock: target.stock });
      }
      return { success: true, offline: false };
    } catch (err) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-return-${returnId}`,
        type: 'RECORD_RETURNS',
        payload: logPayload,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return { success: true, offline: true, message: "Saved to sync pipeline" };
    }
  },

  // Get Returns history log ledger list
  async getReturns() {
    if (!navigator.onLine) {
      return [];
    }
    try {
      const colPath = 'returns';
      const returns: any[] = [];
      const querySnapshot = await getDocs(collection(db, colPath));
      querySnapshot.forEach((docSnap) => {
        returns.push(docSnap.data());
      });
      return returns;
    } catch (err) {
      return [];
    }
  },

  // Get Wholesale Supplier Orders
  async getOrders(): Promise<Order[]> {
    if (!navigator.onLine) {
      return getLocalOrders();
    }
    try {
      const colPath = 'orders';
      const orders: Order[] = [];
      const querySnapshot = await getDocs(collection(db, colPath));
      querySnapshot.forEach((docSnap) => {
        orders.push(docSnap.data() as Order);
      });
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLocalOrders(orders);
      return orders;
    } catch (err) {
      return getLocalOrders();
    }
  },

  // Create Procurement Purchase Order
  async createOrder(orderData: Omit<Order, 'id' | 'status' | 'createdAt'>): Promise<Order> {
    const nextId = `PO-${Date.now()}`;
    const newOrder: Order = {
      ...orderData,
      id: nextId,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    const orders = getLocalOrders();
    orders.unshift(newOrder);
    setLocalOrders(orders);

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-order-${nextId}`,
        type: 'CREATE_ORDER',
        payload: newOrder,
        tempId: nextId,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return newOrder;
    }

    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await setDoc(doc(db, 'orders', nextId), newOrder);
      return newOrder;
    } catch (err) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-order-${nextId}`,
        type: 'CREATE_ORDER',
        payload: newOrder,
        tempId: nextId,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return newOrder;
    }
  },

  // Receive or Cancel Wholesale Packages
  async updateOrder(id: string, status: 'Received' | 'Cancelled'): Promise<Order> {
    const orders = getLocalOrders();
    const idx = orders.findIndex(o => o.id === id);
    let targetOrder: Order;
    
    if (idx !== -1) {
      orders[idx].status = status;
      if (status === 'Received') {
        orders[idx].receivedDate = new Date().toISOString();
      }
      setLocalOrders(orders);
      targetOrder = orders[idx];

      // If status is received, augment drug balances locally
      if (status === 'Received') {
        const meds = getLocalMedicines();
        const mIdx = meds.findIndex(m => m.id === targetOrder.medId);
        if (mIdx !== -1) {
          meds[mIdx].stock += targetOrder.qty;
          setLocalMedicines(meds);
        }
      }
    } else {
      throw new Error("Order package reference missing in database.");
    }

    if (!navigator.onLine) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-order-up-${id}-${Date.now()}`,
        type: 'UPDATE_ORDER',
        payload: { id, status },
        tempId: id,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return targetOrder;
    }

    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await updateDoc(doc(db, 'orders', id), {
        status,
        receivedDate: status === 'Received' ? new Date().toISOString() : undefined
      });

      // Synchronize modified medicine stock online
      if (status === 'Received') {
        const meds = getLocalMedicines();
        const localMed = meds.find(m => m.id === targetOrder.medId);
        if (localMed) {
          await updateDoc(doc(db, 'medicines', String(targetOrder.medId)), { stock: localMed.stock });
        }
      }
      return targetOrder;
    } catch (err) {
      const queue = getPendingQueue();
      queue.push({
        id: `sync-order-up-${id}-${Date.now()}`,
        type: 'UPDATE_ORDER',
        payload: { id, status },
        tempId: id,
        timestamp: Date.now()
      });
      setPendingQueue(queue);
      return targetOrder;
    }
  },

  // HIGH PERFORMANCE BACK-CHANNEL TELEMETRY SYNC ENGINE
  // Sequential automatic transaction pipelines mapping offline storage to Cloud Firestore
  async syncPendingData(): Promise<void> {
    if (!navigator.onLine) return;
    if (isSyncingActive) return;

    const queue = getPendingQueue();
    if (queue.length === 0) return;

    isSyncingActive = true;
    triggerStatusChange();

    console.log(`Pumping ${queue.length} items from local pipeline up into Firebase Firestore...`);
    const successSyncedIds: string[] = [];

    try {
      if (!auth.currentUser) await signInAnonymously(auth);

      for (const item of queue) {
        try {
          switch (item.type) {
            case 'ADD_MEDICINE': {
              await setDoc(doc(db, 'medicines', String(item.payload.id)), item.payload);
              successSyncedIds.push(item.id);
              break;
            }

            case 'UPDATE_MEDICINE': {
              const { id, updates } = item.payload;
              await updateDoc(doc(db, 'medicines', String(id)), updates);
              successSyncedIds.push(item.id);
              break;
            }

            case 'DELETE_MEDICINE': {
              const { id } = item.payload;
              await deleteDoc(doc(db, 'medicines', String(id)));
              successSyncedIds.push(item.id);
              break;
            }

            case 'CREATE_BILL': {
              await setDoc(doc(db, 'bills', String(item.payload.billNo)), item.payload);
              successSyncedIds.push(item.id);
              break;
            }

            case 'RECORD_RETURNS': {
              await setDoc(doc(db, 'returns', String(item.payload.id)), item.payload);
              successSyncedIds.push(item.id);
              break;
            }

            case 'CREATE_ORDER': {
              await setDoc(doc(db, 'orders', String(item.payload.id)), item.payload);
              successSyncedIds.push(item.id);
              break;
            }

            case 'UPDATE_ORDER': {
              const { id, status } = item.payload;
              await updateDoc(doc(db, 'orders', id), {
                status,
                receivedDate: status === 'Received' ? new Date().toISOString() : undefined
              });
              successSyncedIds.push(item.id);
              break;
            }

            case 'ADD_USER': {
              await setDoc(doc(db, 'users', item.payload.username), item.payload);
              successSyncedIds.push(item.id);
              break;
            }

            case 'UPDATE_USER': {
              const { username, updates } = item.payload;
              await updateDoc(doc(db, 'users', username), updates);
              successSyncedIds.push(item.id);
              break;
            }

            case 'DELETE_USER': {
              const { username } = item.payload;
              await deleteDoc(doc(db, 'users', username));
              successSyncedIds.push(item.id);
              break;
            }
          }
        } catch (err) {
          console.error("Individual segment in background queue failed migration", item, err);
          if (!navigator.onLine) break; // Terminate early if connectivity dies mid-packet
        }
      }
    } finally {
      // Clear successfully synchronized packets of task arrays
      const currentQueue = getPendingQueue();
      const remainingQueue = currentQueue.filter(q => !successSyncedIds.includes(q.id));
      setPendingQueue(remainingQueue);

      isSyncingActive = false;
      triggerStatusChange();
      console.log("Firebase background sync cycle completed successfully.");
    }
  }
};
