export interface Staff {
  id: string;
  uid?: string; // Link to Firebase Auth UID
  name: string;
  phone: string;
  email: string;
  specialty: string;
  commission: number;
  role: 'admin' | 'agente' | 'staff';
  status: 'active' | 'inactive';
  enabledCategories?: string[];
  photoUrl?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  sku?: string;
  stock: number;
  costPrice: number;
  salePrice: number;
  supplier?: string;
  expiryDate?: string;
  images: string[];
  mainImage?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  staffId: string;
  service: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  price: number;
  commissionAmount: number;
  marker?: string;
  paymentMethod?: 'dinheiro' | 'debito' | 'credito' | '';
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description?: string;
  creatorId?: string;
  creatorName?: string;
  professionalId?: string;
  appointmentId?: string;
  paymentMethod?: 'dinheiro' | 'debito' | 'credito' | '';
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration?: number;
  category?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'agente' | 'staff';
  name: string;
}
