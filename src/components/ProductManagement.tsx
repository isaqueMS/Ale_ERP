import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Package, 
  DollarSign, BarChart3, X, Image as ImageIcon,
  Tag, ChevronRight, AlertCircle, TrendingUp, ArrowRight
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sku: '',
    stock: 0,
    costPrice: 0,
    salePrice: 0,
    images: [] as string[]
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return unsub;
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData, stock: Number(formData.stock), costPrice: Number(formData.costPrice), salePrice: Number(formData.salePrice), createdAt: new Date().toISOString() };
    if (editingProduct) await updateDoc(doc(db, 'products', editingProduct.id), data);
    else await addDoc(collection(db, 'products'), data);
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
           <h2 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight">Produtos & Estoque</h2>
           <p className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">Gerencie seus produtos, custos e margens de lucro.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full sm:w-auto">
          <Plus className="w-5 h-5" /> Novo Produto
        </button>
      </header>

      {/* SEARCH BAR FROM PHOTO */}
      <div className="relative group">
         <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center transition-transform group-focus-within:scale-110">
            <Search className="w-5 h-5 text-[#FFB6C1]" />
         </div>
         <input 
            type="text" 
            placeholder="Buscar por nome ou categoria..." 
            className="input-premium pl-16 pr-6 !py-4 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
         />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {filteredProducts.map(product => {
          const profit = product.salePrice - product.costPrice;
          const profitMargin = ((profit / product.salePrice) * 100).toFixed(0);

          return (
            <div key={product.id} className="card-premium p-8 relative flex flex-col justify-between min-h-[300px] group transition-all">
               <div>
                  <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mb-6 border border-pink-100 shadow-sm transition-transform group-hover:scale-105 group-hover:rotate-6">
                     <Package className="w-7 h-7 text-[#FFB6C1]" />
                  </div>
                  <p className="text-[10px] font-black text-[#FFB6C1] uppercase tracking-[0.2em] mb-1">{product.category || 'REVEND'}</p>
                  <h3 className="text-xl font-black text-slate-800 uppercase leading-tight mb-1 tracking-tight">{product.name}</h3>
                  <p className="text-[10px] font-bold text-slate-300 uppercase italic">SKU: {product.sku || '00000'}</p>
               </div>

               <div className="mt-8 space-y-6">
                  <div className="flex items-center gap-12">
                     <div>
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Preço Venda</p>
                        <p className="text-xl font-black text-slate-800 font-mono tracking-tighter italic">{formatCurrency(product.salePrice)}</p>
                     </div>
                     <div>
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Disponível</p>
                        <p className="text-xl font-black text-slate-800 font-mono tracking-tighter">{product.stock} un</p>
                     </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                     <div className="flex items-center gap-1 text-green-500 font-black text-[10px] italic">
                        <TrendingUp className="w-3.5 h-3.5" /> {profitMargin}% MARGEM LUCRO
                     </div>
                  </div>
               </div>

               {/* Hover Actions */}
               <div className="absolute top-6 right-6 flex gap-2">
                  <button onClick={() => { setEditingProduct(product); setFormData({ ...product }); setIsModalOpen(true); }} className="p-2.5 bg-white text-slate-400 hover:text-[#FFB6C1] rounded-xl border border-slate-100 shadow-sm active:scale-90 transition-all"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => deleteDoc(doc(db, 'products', product.id))} className="p-2.5 bg-white text-slate-400 hover:text-red-400 rounded-xl border border-slate-100 shadow-sm active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
               </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-center mb-6 shrink-0 pr-8">
                <div>
                   <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{editingProduct ? 'Editar' : 'Novo'} Produto</h3>
                   <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Cadastro de estoque para studio.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Nome do Produto</label>
                  <input required className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="Ex: Batom Matte 24h" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">SKU / Código</label>
                    <input className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="REF-001" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Categoria</label>
                    <input className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="Maquiagem / Cabelo" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-2">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Estoque</label>
                    <input required type="number" className="input-premium !py-2.5 !px-5 font-mono shadow-sm" placeholder="0" value={formData.stock} onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Custo (R$)</label>
                    <input required type="number" step="0.01" className="input-premium !py-2.5 !px-5 font-mono shadow-sm" placeholder="0,00" value={formData.costPrice} onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Venda (R$)</label>
                    <input required type="number" step="0.01" className="input-premium !py-2.5 !px-5 font-mono shadow-sm" placeholder="0,00" value={formData.salePrice} onChange={(e) => setFormData({...formData, salePrice: Number(e.target.value)})} />
                  </div>
                </div>
                <button type="submit" className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black group shadow-xl transition-all active:scale-95 hover:shadow-pink-100 flex items-center justify-center gap-3">
                   Atualizar Estoque Studio <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
