import React from 'react';
import { Plus, Search, Edit2, Trash2, Scissors, Clock, DollarSign, XCircle, Tag, Info } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Service } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';

export default function ServiceManagement() {
  const { isAdmin } = useAuth();
  const [services, setServices] = React.useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    price: 0,
    duration: 30,
    category: 'Serviço'
  });

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serviceData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      setServices(serviceData);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), formData);
      } else {
        await addDoc(collection(db, 'services'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingService(null);
      setFormData({ name: '', description: '', price: 0, duration: 30, category: 'Serviço' });
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price,
      duration: service.duration || 30,
      category: service.category || 'Serviço'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (confirm('Tem certeza que deseja excluir este serviço?')) {
      await deleteDoc(doc(db, 'services', id));
    }
  };

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isMobile) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-[#FDFDFD] min-h-screen">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-text tracking-tighter uppercase">Serviços</h2>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-none">Menu de procedimentos</p>
        </header>

        <div className="mobile-card p-3 flex items-center gap-3 bg-white border border-secondary shadow-premium">
          <Search className="text-primary w-4 h-4 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar serviço ou categoria..." 
            className="bg-transparent flex-1 border-none focus:ring-0 text-xs font-bold text-text placeholder:text-muted p-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredServices.map((service) => (
            <div key={service.id} className="mobile-card p-4 border border-secondary/20 bg-white relative overflow-hidden group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0",
                    service.category?.toLowerCase().includes('cabelo') ? "bg-primary/10 text-primary" :
                    service.category?.toLowerCase().includes('unha') ? "bg-accent/10 text-accent" : "bg-secondary text-muted"
                  )}>
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted">{service.category || 'Geral'}</span>
                    <h4 className="font-black text-base text-text leading-tight uppercase tracking-tighter">{service.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-bold text-muted">{service.duration} min</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-text tracking-tighter">{formatCurrency(service.price)}</p>
                </div>
              </div>

              {service.description && (
                <p className="text-[10px] font-medium text-muted mb-4 border-l-2 border-secondary/20 pl-2 italic line-clamp-2">
                  {service.description}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-secondary/10">
                {isAdmin && (
                  <>
                    <button onClick={() => handleEdit(service)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 active:scale-95">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(service.id)} className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100 active:scale-95">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <button 
            onClick={() => { setEditingService(null); setIsModalOpen(true); }}
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
          <h2 className="text-3xl font-black text-text tracking-tighter uppercase">Menu de Serviços</h2>
          <p className="text-muted mt-1 font-bold">Configure os procedimentos, durações e valores de mercado.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setEditingService(null); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2 py-3 px-8 shadow-premium"
          >
            <Plus className="w-5 h-5" />
            Novo Serviço
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <div key={service.id} className="glass-card overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-1 border border-secondary/30 bg-white shadow-premium">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className={cn(
                  "p-4 rounded-2xl shadow-inner",
                  service.category?.toLowerCase().includes('cabelo') ? "bg-primary/10 text-primary" :
                  service.category?.toLowerCase().includes('unha') ? "bg-accent/10 text-accent" : "bg-secondary text-muted"
                )}>
                  <Scissors className="w-6 h-6" />
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(service)} className="p-2 hover:bg-blue-50 text-muted hover:text-blue-600 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(service.id)} className="p-2 hover:bg-red-50 text-muted hover:text-red-600 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 block">{service.category || 'Geral'}</span>
                <h4 className="text-xl font-black text-text uppercase tracking-tighter leading-tight">{service.name}</h4>
                {service.description && (
                  <p className="text-xs text-muted mt-2 font-medium italic border-l-2 border-secondary/30 pl-3 line-clamp-3 leading-relaxed">
                    {service.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-secondary/20">
                <div className="flex items-center gap-2 bg-secondary/10 px-4 py-2 rounded-2xl">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black uppercase tracking-tighter">{service.duration} min</span>
                </div>
                <p className="text-2xl font-black text-text tracking-tighter">{formatCurrency(service.price)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {renderModal()}
    </div>
  );

  function renderModal() {
    return (
      <>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-secondary/20 rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-muted" />
              </button>
              
              <h3 className="text-2xl font-black tracking-tighter mb-8 uppercase flex items-center gap-3">
                <Scissors className="w-8 h-8 text-primary" />
                {editingService ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Nome do Procedimento</label>
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
                      <option value="Serviço">Serviço</option>
                      <option value="Cabelo">Cabelo</option>
                      <option value="Unhas">Unhas</option>
                      <option value="Barba">Barba</option>
                      <option value="Estética">Estética</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Preço (R$)</label>
                    <input 
                      required
                      type="number" step="0.01"
                      className="input-field py-3 font-bold" 
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Duração Estimada (minutos)</label>
                    <input 
                      required
                      type="number"
                      className="input-field py-3 font-bold" 
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Notas / Detalhes</label>
                    <textarea 
                      className="input-field min-h-[100px] text-xs py-3" 
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ex: Inclui lavagem e secagem..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs font-black uppercase tracking-widest px-8">Sair</button>
                  <button type="submit" className="btn-primary text-xs font-black uppercase tracking-widest px-8 shadow-lg">Salvar Serviço</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }
}
