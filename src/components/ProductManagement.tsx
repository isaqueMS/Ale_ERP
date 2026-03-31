import React from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, TrendingUp, XCircle, Info, DollarSign } from 'lucide-react';
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
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    category: 'Produto',
    sku: '',
    stock: 0,
    costPrice: 0,
    salePrice: 0,
    supplier: '',
    expiryDate: ''
  });

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productData);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), formData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', description: '', category: 'Produto', sku: '', stock: 0, costPrice: 0, salePrice: 0, supplier: '', expiryDate: '' });
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto.');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category,
      sku: product.sku || '',
      stock: product.stock,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      supplier: product.supplier || '',
      expiryDate: product.expiryDate || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isMobile) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-[#F9F9F9] min-h-screen">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-text tracking-tighter uppercase">Estoque</h2>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-none">Total: {products.length} itens</p>
        </header>

        <div className="mobile-card p-3 flex items-center gap-3 bg-white border border-secondary shadow-premium">
          <Search className="text-primary w-4 h-4 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar produto ou marca..." 
            className="bg-transparent flex-1 border-none focus:ring-0 text-xs font-bold text-text placeholder:text-muted p-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const isLowStock = product.stock <= 5;
            const isOut = product.stock <= 0;
            
            return (
              <div key={product.id} className={cn(
                "mobile-card p-4 border relative overflow-hidden bg-white",
                isOut ? "border-red-200" : isLowStock ? "border-yellow-200" : "border-secondary/20"
              )}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0",
                      isOut ? "bg-red-50 text-red-500" : isLowStock ? "bg-yellow-50 text-yellow-600" : "bg-primary/10 text-primary"
                    )}>
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted">{product.category}</span>
                      <h4 className="font-black text-base text-text leading-tight uppercase tracking-tighter">{product.name}</h4>
                      <p className="text-[9px] font-bold text-muted italic">SKU: {product.sku || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-accent">{formatCurrency(product.salePrice)}</p>
                    <div className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase mt-1",
                      isOut ? "bg-red-500 text-white" : isLowStock ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                    )}>
                      {isOut ? 'Esgotado' : isLowStock ? `Só ${product.stock} un` : `${product.stock} un`}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-secondary/10">
                  <div className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase">
                    <TrendingUp className="w-3 h-3" />
                    Lucro: {formatCurrency(product.salePrice - product.costPrice)}
                  </div>
                  <div className="flex gap-2">
                    {isAdmin && (
                      <>
                        <button onClick={() => handleEdit(product)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 active:scale-95">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100 active:scale-95">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <button 
            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
            className="fab-button"
          >
            <Plus className="w-8 h-8" />
          </button>
        )}

        {renderModal()}
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-text tracking-tighter uppercase">Produtos & Estoque</h2>
          <p className="text-muted mt-1 font-bold">Gerencie seus produtos, custos e margens de lucro.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2 py-3 px-8 shadow-premium"
          >
            <Plus className="w-5 h-5" />
            Novo Produto
          </button>
        )}
      </header>

      <div className="glass-card p-4 flex items-center gap-4 bg-white/70 shadow-premium border border-secondary/30">
        <Search className="text-primary w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou categoria..." 
          className="bg-transparent flex-1 border-none focus:ring-0 text-text font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const profit = product.salePrice - product.costPrice;
          const isLowStock = product.stock <= 5;

          return (
            <div key={product.id} className="glass-card overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-1 border border-secondary/30 bg-white shadow-premium">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-inner",
                    isLowStock ? "bg-red-50 text-red-500" : "bg-primary/10 text-primary"
                  )}>
                    <Package className="w-6 h-6" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(product)} className="p-2 hover:bg-blue-50 text-muted hover:text-blue-600 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="p-2 hover:bg-red-50 text-muted hover:text-red-600 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">{product.category}</p>
                    {isLowStock && (
                      <span className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase tracking-tighter bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-2 h-2" /> Estoque Baixo
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-black text-text truncate uppercase tracking-tighter">{product.name}</h4>
                  <p className="text-[10px] font-bold text-muted italic">SKU: {product.sku || 'N/A'}</p>
                </div>

                <div className="flex justify-between items-end bg-secondary/5 p-3 rounded-2xl">
                  <div>
                    <p className="text-[9px] text-muted uppercase font-black tracking-widest mb-1">Preço Venda</p>
                    <p className="text-xl font-black text-text">{formatCurrency(product.salePrice)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-muted uppercase font-black tracking-widest mb-1">Disponível</p>
                    <p className={cn(
                      "text-lg font-black",
                      isLowStock ? "text-red-500" : "text-text"
                    )}>{product.stock} un</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-secondary/20 flex justify-between items-center">
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{((profit / product.salePrice) * 100).toFixed(0)}% Lucro</span>
                  </div>
                  <span className="text-[10px] text-muted font-bold italic">{product.supplier || ''}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {renderModal()}
    </div>
  );

  function renderModal() {
    return (
      <>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-y-auto max-h-[90vh]">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-secondary/20 rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-muted" />
              </button>
              
              <h3 className="text-2xl font-black tracking-tighter mb-8 uppercase flex items-center gap-3">
                <Package className="w-8 h-8 text-primary" />
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Nome Fantasia do Produto</label>
                    <input 
                      required
                      type="text" 
                      className="input-field py-3 font-bold" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Categoria</label>
                    <select 
                      required
                      className="input-field py-3 font-bold" 
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Produto">Produto</option>
                      <option value="Revenda">Revenda</option>
                      <option value="Uso Interno">Uso Interno</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">SKU / Código</label>
                    <input 
                      type="text" 
                      className="input-field py-3 font-bold" 
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Preço de Custo (R$)</label>
                    <input 
                      required
                      type="number" step="0.01"
                      className="input-field py-3 font-bold" 
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Preço de Venda (R$)</label>
                    <input 
                      required
                      type="number" step="0.01"
                      className="input-field py-3 font-bold" 
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Estoque Inicial</label>
                    <input 
                      required
                      type="number"
                      className="input-field py-3 font-bold" 
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Validade (se houver)</label>
                    <input 
                      type="date"
                      className="input-field py-3 font-bold" 
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Descrição Curta</label>
                    <textarea 
                      className="input-field min-h-[100px] text-xs py-3" 
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs font-black uppercase tracking-widest px-8">Sair</button>
                  <button type="submit" className="btn-primary text-xs font-black uppercase tracking-widest px-8 shadow-lg">Salvar Produto</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }
}
