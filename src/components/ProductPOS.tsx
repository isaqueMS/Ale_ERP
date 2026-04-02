import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Minus, ShoppingCart, Search, Trash2, 
  CheckCircle2, ArrowRight, Package, User,
  X, ChevronRight, Sparkles, CreditCard
} from 'lucide-react';
import { 
  collection, onSnapshot, addDoc, doc, 
  updateDoc, increment, runTransaction, writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Client } from '../types';
import { format } from 'date-fns';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';

interface CartItem extends Product {
  quantity: number;
}

export default function ProductPOS() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubC = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => { unsubP(); unsubC(); };
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, Math.min(item.quantity + delta, item.stock));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || loading) return;
    setLoading(true);
    try {
      const client = clients.find(c => c.id === selectedClientId);
      const batch = writeBatch(db);
      
      for (const item of cart) {
        // 1. Update Stock
        const productRef = doc(db, 'products', item.id);
        batch.update(productRef, {
          stock: increment(-item.quantity)
        });

        // 2. Create Transaction
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          type: 'income',
          category: 'Venda de Produto',
          amount: Number(item.salePrice * item.quantity),
          description: `Venda: ${item.quantity}x ${item.name}${client ? ' para ' + client.name : ''}`,
          date: format(new Date(), 'yyyy-MM-dd'),
          creatorId: user?.uid,
          creatorName: profile?.name || user?.displayName || 'Sistema',
          clientName: client?.name || 'Cliente Avulso',
          clientId: selectedClientId || null,
          createdAt: new Date().toISOString()
        });
      }

      await batch.commit();

      setCart([]);
      setSelectedClientId('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("ERRO NO CHECKOUT:", error);
      alert('Erro ao processar venda: ' + (error instanceof Error ? error.message : 'Verifique a conexão'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 min-h-[calc(100vh-160px)] animate-fade-up">
      {/* LEFT: PRODUCT CATALOG */}
      <div className="flex-1 space-y-8">
        <header className="space-y-2">
           <div className="flex items-center gap-3">
             <div className="w-2 h-8 bg-[#FFB6C1] rounded-full shadow-[0_0_15px_rgba(255,182,193,0.5)]" />
             <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight">Vender Produtos</h2>
           </div>
           <p className="text-slate-400 font-bold text-sm uppercase tracking-widest ml-5">Agilidade no PDV para sua lojinha.</p>
        </header>

        <div className="relative group">
           <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center">
              <Search className="w-5 h-5 text-[#FFB6C1] transition-transform group-focus-within:scale-110" />
           </div>
           <input 
              type="text" 
              placeholder="Pesquisar produto no estoque..." 
              className="input-premium pl-16 pr-6 !py-5 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
           {filteredProducts.map(product => (
             <button 
               key={product.id}
               onClick={() => addToCart(product)}
               disabled={product.stock <= 0}
               className={cn(
                 "card-premium p-6 text-left group transition-all active:scale-95",
                 product.stock <= 0 ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-[#FFB6C1]"
               )}
             >
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center mb-4 border border-pink-100 group-hover:bg-[#FFB6C1] group-hover:text-white transition-colors">
                   <Package className="w-6 h-6" />
                </div>
                <p className="text-[9px] font-black text-[#FFB6C1] uppercase tracking-widest mb-1">{product.category}</p>
                <h3 className="text-sm font-black text-slate-800 uppercase leading-snug mb-3 h-10 overflow-hidden line-clamp-2">{product.name}</h3>
                <div className="flex items-center justify-between mt-auto">
                   <span className="text-lg font-black text-slate-800 font-mono tracking-tighter">{formatCurrency(product.salePrice)}</span>
                   <span className={cn(
                     "text-[9px] font-black px-2 py-1 rounded-lg uppercase",
                     product.stock < 5 ? "bg-red-50 text-red-400" : "bg-slate-50 text-slate-400"
                   )}>
                     {product.stock} un
                   </span>
                </div>
             </button>
           ))}
        </div>
      </div>

      {/* RIGHT: SHOPPING CART / CHECKOUT (Sticky on Desktop, Bottom Sheet on Mobile) */}
      <div className="lg:w-[400px] shrink-0">
         <div className="bg-white rounded-[2rem] shadow-xl border border-pink-50 p-6 md:p-8 sticky top-10 flex flex-col h-fit lg:max-h-[calc(100vh-100px)]">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                 <ShoppingCart className="w-5 h-5 text-[#FFB6C1]" /> Carrinho
               </h3>
               {cart.length > 0 && <button onClick={() => setCart([])} className="text-[9px] font-black text-red-300 uppercase hover:text-red-500 transition-colors">Limpar</button>}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 -mr-2 min-h-[150px]">
               {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16 opacity-30">
                    <ShoppingCart className="w-12 h-12 text-slate-200" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">O carrinho está<br/>vazio agora</p>
                 </div>
               ) : (
                 cart.map(item => (
                   <div key={item.id} className="bg-[#FFFDFB] p-4 rounded-2xl border border-pink-50/50 flex items-center justify-between group">
                      <div className="flex-1 min-w-0 mr-3">
                         <h4 className="text-[11px] font-black text-slate-800 uppercase truncate">{item.name}</h4>
                         <p className="text-[9px] font-black text-[#FFB6C1] font-mono mt-0.5">{formatCurrency(item.salePrice)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="flex items-center bg-white rounded-lg border border-pink-50 p-0.5">
                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-slate-300 hover:text-[#FFB6C1] transition-colors"><Minus className="w-3 h-3" /></button>
                            <span className="w-6 text-center text-[10px] font-black text-slate-700">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-slate-300 hover:text-[#FFB6C1] transition-colors"><Plus className="w-3 h-3" /></button>
                         </div>
                         <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-red-100 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                   </div>
                 ))
               )}
            </div>

            <div className="mt-6 pt-6 border-t-2 border-slate-50 space-y-6">
               <div className="space-y-3">
                  <div className="relative pt-1.5 font-sans">
                     <label className="floating-label">Vincular Cliente (Opcional)</label>
                     <div className="relative">
                        <select 
                          className="select-premium !py-3 !px-5 text-[10px] font-black uppercase tracking-widest"
                          value={selectedClientId}
                          onChange={e => setSelectedClientId(e.target.value)}
                        >
                          <option value="">Cliente Avulso / Balcão</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                     </div>
                  </div>
               </div>

               <div className="flex items-end justify-between px-1 mb-2">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total da Venda</span>
                  <span className="text-3xl font-black text-slate-800 font-mono tracking-tighter leading-none italic">{formatCurrency(total)}</span>
               </div>

               <button 
                 disabled={cart.length === 0 || loading}
                 onClick={handleCheckout}
                 className={cn(
                   "w-full h-14 rounded-2xl btn-primary flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.2em] font-black transition-all shadow-xl active:scale-95 group",
                   (cart.length === 0 || loading) && "opacity-50 pointer-events-none"
                 )}
               >
                  {loading ? (
                    <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Concluir Venda Studio <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
               </button>
            </div>
         </div>
      </div>

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-10 right-4 md:right-10 z-[100] animate-fade-up">
           <div className="bg-emerald-500 text-white p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 border-4 border-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
              <div>
                 <p className="text-sm font-black uppercase tracking-widest">Venda Realizada!</p>
                 <p className="text-[10px] font-bold text-white/80 uppercase mt-0.5">O estoque foi atualizado e o caixa registrado.</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
