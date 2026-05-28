export interface Medicine {
  id: number;
  name: string;
  company: string;
  salt: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  expiry: string;
  shelf?: string;
  supplier?: string;
}

export interface CartItem extends Medicine {
  qty: number;
}

export interface Bill {
  billNo: string;
  date: string;
  customer: string;
  items: CartItem[];
  subtotal: number;
  discountPercent: number;
  discountVal: number;
  grandTotal: number;
  cashierName?: string;
}

export interface Order {
  id: string;
  medId: number;
  medName: string;
  qty: number;
  supplier: string;
  expectedDate: string;
  status: 'Pending' | 'Received' | 'Cancelled';
  createdAt: string;
  receivedDate?: string;
}

export type UserRole = 'admin' | 'cashier' | 'stock_manager';

export interface UserAccount {
  username: string;
  role: UserRole;
  password?: string;
}

