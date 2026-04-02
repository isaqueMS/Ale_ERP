import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Clock, DollarSign, 
  X, Scissors, Sparkles, ChevronRight, Filter, ArrowRight
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Service } from '../types';
import { cn, formatCurrency } from '../lib/utils';

import { SERVICE_CATEGORIES } from '../constants';

export default function ServiceManagement() {
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    duration: 30,
    category: SERVICE_CATEGORIES[0]
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });
    return unsub;
  }, []);

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData, price: Number(formData.price), duration: Number(formData.duration), createdAt: new Date().toISOString() };
    if (editingService) await updateDoc(doc(db, 'services', editingService.id), data);
    else await addDoc(collection(db, 'services'), data);
    setIsModalOpen(false);
    setEditingService(null);
    setFormData({ name: '', description: '', price: 0, duration: 30, category: SERVICE_CATEGORIES[0] });
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex justify-between items-start">
        <div>
           <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Menu de Serviços</h2>
           <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">Configure procedimentos, durações e valores.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          <Plus className="w-5 h-5" /> Novo Serviço
        </button>
      </header>

      {/* SEARCH BAR MATCHING PHOTO */}
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
        {filteredServices.map(service => (
          <div key={service.id} className="card-premium p-8 relative flex flex-col justify-between min-h-[220px] group transition-all">
             <div>
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center mb-6 border border-pink-100 shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-3">
                   <Scissors className="w-6 h-6 text-[#FFB6C1]" />
                 </div>
                <p className="text-[10px] font-black text-[#FFB6C1] uppercase tracking-[0.2em] mb-1">{service.category || 'Geral'}</p>
                <h3 className="text-xl font-black text-slate-800 uppercase leading-tight tracking-tight">{service.name}</h3>
             </div>

             <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                   <Clock className="w-4 h-4 text-pink-200" />
                   <span className="text-xs font-black uppercase tracking-tight italic">{service.duration} min</span>
                </div>
                <div className="text-right">
                   <span className="text-2xl font-black text-slate-800 font-mono tracking-tighter italic">{formatCurrency(service.price)}</span>
                </div>
             </div>

             {/* Hover Actions */}
             <div className="absolute top-6 right-6 flex gap-2">
                <button onClick={() => { setEditingService(service); setFormData({ ...service }); setIsModalOpen(true); }} className="p-2.5 bg-white text-slate-400 hover:text-[#FFB6C1] rounded-xl transition-all border border-slate-100 shadow-sm active:scale-90"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => deleteDoc(doc(db, 'services', service.id))} className="p-2.5 bg-white text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-100 shadow-sm active:scale-90"><Trash2 className="w-4 h-4" /></button>
             </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-center mb-6 shrink-0 pr-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{editingService ? 'Editar' : 'Novo'} Serviço</h3>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Menu de Procedimentos Studio.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Nome do Serviço</label>
                  <input required className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="Ex: Corte de Cabelo" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Preço Venda (R$)</label>
                    <input required type="number" step="0.01" className="input-premium !py-2.5 !px-5 font-mono shadow-sm" placeholder="0,00" value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Duração Est. (min)</label>
                    <input required type="number" className="input-premium !py-2.5 !px-5 font-mono shadow-sm" placeholder="30" value={formData.duration} onChange={(e) => setFormData({...formData, duration: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="relative pt-1.5 font-sans mb-6">
                  <label className="floating-label">Categoria</label>
                  <select className="select-premium !py-2.5 !px-5 shadow-sm" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                     {SERVICE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black group shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-pink-100">
                   Confirmar Procedimento <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

