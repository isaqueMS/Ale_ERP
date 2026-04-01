import React from 'react';
import { Plus, Search, Edit3, Trash2, Package, AlertTriangle, TrendingUp, XCircle, BarChart2 } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';

export default function ProductManagement() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [formData, setFormData] = React.useState({ name: '', description: '', category: 'Produto', sku: '', stock: 0, costPrice: 0, salePrice: 0, supplier: '', expiryDate: '' });

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) await updateDoc(doc(db, 'products', editingProduct.id), formData);
      else await addDoc(collection(db, 'products'), { ...formData, createdAt: new Date().toISOString() });
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', description: '', category: 'Produto', sku: '', stock: 0, costPrice: 0, salePrice: 0, supplier: '', expiryDate: '' });
    } catch (error) { console.error(error); }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-12 pb-24 px-4 pt-4 bg-background min-h-screen lg:px-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end border-b border-white/5 pb-8">
        <div>
           <h2 className="industrial-header">Terminal de <span className="metallic-gold">Estoque</span></h2>
           <p className="text-[10px] font-black text-muted uppercase tracking-[0.5em] mt-2 opacity-40">Inventory Management • {products.length} Ativos</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="btn-accent px-10 py-5 rounded-3xl shadow-2xl flex items-center gap-3">
             <Plus className="w-6 h-6" /> Novo Produto
          </button>
        )}
      </header>

      <div className="glass-card p-10 bg-secondary/20 border-white/5 flex items-center gap-6">
         <Search className="w-6 h-6 text-accent" />
         <input type="text" placeholder="LOCALIZAR ITEM OU CATEGORIA..." className="input-field py-5 bg-primary border-none shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredProducts.map((p) => {
          const isLow = p.stock <= 5;
          const isOut = p.stock <= 0;
          return (
            <div key={p.id} className="glass-card group p-8 bg-secondary/20 border-white/5 hover:bg-secondary/40 transition-all relative overflow-hidden">
               <div className="flex justify-between items-start mb-8">
                  <div className={cn("w-16 h-16 rounded-[2rem] flex items-center justify-center border shadow-2xl transition-all", isOut ? "bg-red-500/10 border-red-500/20 text-red-400" : isLow ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" : "bg-accent/10 border-accent/20 text-accent")}>
                     <Package className="w-8 h-8" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => { setEditingProduct(p); setFormData(p as any); setIsModalOpen(true); }} className="p-3 bg-white/5 rounded-xl text-muted hover:text-white transition-all"><Edit3 className="w-4 h-4" /></button>
                       <button onClick={async () => { if(confirm('Excluir?')) await deleteDoc(doc(db, 'products', p.id)); }} className="p-3 bg-white/5 rounded-xl text-muted hover:text-red-400 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
               </div>
               <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-accent opacity-60">{p.category}</span>
                  <h4 className="text-xl font-black text-text uppercase tracking-tighter truncate leading-none">{p.name}</h4>
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40 italic">SKU: {p.sku || 'N/A'}</p>
               </div>
               <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/5">
                  <div>
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Preço Venda</p>
                    <p className="text-xl font-black text-text tracking-tighter leading-none">{formatCurrency(p.salePrice)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Estoque</p>
                    <p className={cn("text-xl font-black tracking-tighter leading-none", isOut ? "text-red-400" : isLow ? "text-yellow-400" : "text-text")}>{p.stock} UN</p>
                  </div>
               </div>
               <div className="mt-6 flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-green-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{(( (p.salePrice - p.costPrice) / p.salePrice) * 100).toFixed(0)}% Lucro</span>
                  </div>
                  <span className="text-[8px] font-black text-muted uppercase tracking-widest opacity-40">{p.supplier || 'Logística S/N'}</span>
               </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[150] flex items-center justify-center p-4">
           <div className="bg-primary/95 border border-white/10 rounded-[3rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-hide">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-10 text-muted hover:text-white transition-colors"><XCircle className="w-8 h-8" /></button>
              <h3 className="industrial-header text-3xl mb-10">Lote de <span className="metallic-gold">Mercadoria</span></h3>
              <form onSubmit={handleSubmit} className="space-y-8">
                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                       <div className="col-span-2"><label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Identificação</label><input required className="input-field py-5 bg-background border-white/5" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="NOME DO PRODUTO" /></div>
                       <div><label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Categoria</label><select className="input-field py-5 bg-background border-white/5" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}><option value="Produto">Produto</option><option value="Revenda">Revenda</option><option value="Uso Interno">Uso Interno</option></select></div>
                       <div><label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Lote / SKU</label><input className="input-field py-5 bg-background border-white/5" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} placeholder="000-000" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                       <div><label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Custo (R$)</label><input required type="number" step="0.01" className="input-field py-5 bg-background border-white/5" value={formData.costPrice} onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})} /></div>
                       <div><label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Venda (R$)</label><input required type="number" step="0.01" className="input-field py-5 bg-background border-white/5" value={formData.salePrice} onChange={(e) => setFormData({...formData, salePrice: Number(e.target.value)})} /></div>
                       <div><label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Estoque Unidades</label><input required type="number" className="input-field py-5 bg-background border-white/5" value={formData.stock} onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} /></div>
                    </div>
                    <div><label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Observações Técnicas</label><textarea className="input-field py-5 bg-background border-white/5 min-h-[100px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="ESPECIFICAÇÕES..." /></div>
                 </div>
                 <div className="flex gap-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Abortar</button>
                    <button type="submit" className="btn-accent flex-1">Salvar no Acervo</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
