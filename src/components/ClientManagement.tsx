import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit3, Trash2, User, 
  Phone, Mail, Calendar, X, MoreVertical,
  ChevronRight, MessageSquare, Star, 
  Clock, MapPin, ArrowRight
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client } from '../types';
import { cn } from '../lib/utils';

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthDate: '',
    notes: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return unsub;
  }, []);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData, createdAt: new Date().toISOString() };
    if (editingClient) await updateDoc(doc(db, 'clients', editingClient.id), data);
    else await addDoc(collection(db, 'clients'), data);
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', birthDate: '', notes: '' });
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
           <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Gestão de Clientes</h2>
           <p className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">Sua base de dados premium.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full sm:w-auto">
          <Plus className="w-5 h-5" /> Novo Cliente
        </button>
      </header>

      {/* SEARCH BAR */}
      <div className="relative group">
         <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center">
            <Search className="w-5 h-5 text-[#FFB6C1]" />
         </div>
         <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
            className="input-premium pl-16 pr-6 !py-4 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
         />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {filteredClients.map(client => (
          <div key={client.id} className="card-premium p-8 relative flex flex-col justify-between min-h-[250px] group transition-all">
             <div>
                <div className="flex justify-between items-start mb-6">
                   <div className="w-16 h-16 bg-[#FFFDFB] rounded-[1.5rem] flex items-center justify-center border border-slate-100 shadow-sm text-[#FFB6C1] font-black text-2xl uppercase transition-transform group-hover:scale-105 group-hover:rotate-3">
                      {client.name[0]}
                   </div>
                   <div className="flex gap-2">
                      <button className="p-2.5 bg-pink-50 text-[#FFB6C1] rounded-xl hover:bg-[#FFB6C1] hover:text-white transition-all shadow-sm"><MessageSquare className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingClient(client); setFormData({ ...client }); setIsModalOpen(true); }} className="p-2.5 bg-white text-slate-400 hover:text-slate-600 rounded-xl transition-all border border-slate-100 shadow-sm active:scale-90"><Edit3 className="w-4 h-4" /></button>
                   </div>
                </div>

                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2 truncate">{client.name}</h3>
                
                <div className="space-y-3">
                   <div className="flex items-center gap-3 text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-pink-200" />
                      <span className="text-xs font-bold">{client.phone}</span>
                   </div>
                   {client.email && (
                     <div className="flex items-center gap-3 text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-pink-200" />
                        <span className="text-xs font-bold truncate max-w-[200px]">{client.email}</span>
                     </div>
                   )}
                </div>
             </div>

             <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between font-['Outfit']">
                <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-amber-500" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nasc: {client.birthDate ? new Date(client.birthDate).toLocaleDateString('pt-BR') : '--'}</span>
                </div>
                <button onClick={() => deleteDoc(doc(db, 'clients', client.id))} className="text-red-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
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
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{editingClient ? 'Editar' : 'Novo'} Cliente</h3>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Cadastro premium para studio.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Nome Completo</label>
                  <input required className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="Ex: Maria Alexandra" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Telefone/Zap</label>
                    <input required className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="(11) 99999-9999" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Data Nasc.</label>
                    <input type="date" className="input-premium !py-2.5 !px-5 shadow-sm uppercase font-black !text-[10px]" value={formData.birthDate} onChange={(e) => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                </div>
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Email Secundário</label>
                  <input type="email" className="input-premium !py-2.5 !px-5 shadow-sm" placeholder="cliente@email.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="relative pt-1.5 font-sans mb-4">
                   <label className="label-premium !text-[9px] !mb-1.5">Observações / Preferências</label>
                   <textarea className="textarea-premium !h-24 shadow-inner" placeholder="Preferências, alergias ou observações técnicas..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                </div>
                <button type="submit" className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black group shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3">
                   Finalizar Cadastro <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
