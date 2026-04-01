import React from 'react';
import { Plus, Search, Edit3, Trash2, Phone, Mail, Calendar, MessageCircle, Info, XCircle, User, Scissors, Clock } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client } from '../types';
import { cn, formatPhone, getWhatsAppLink, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientManagement() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [formData, setFormData] = React.useState({ name: '', phone: '', email: '', birthDate: '', notes: '' });
  const [viewingHistory, setViewingHistory] = React.useState<Client | null>(null);
  const [historyData, setHistoryData] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) await updateDoc(doc(db, 'clients', editingClient.id), formData);
      else await addDoc(collection(db, 'clients'), { ...formData, createdAt: new Date().toISOString() });
      setIsModalOpen(false);
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '', birthDate: '', notes: '' });
    } catch (error) { console.error(error); }
  };

  const handleHistory = async (client: Client) => {
    setViewingHistory(client);
    setLoadingHistory(true);
    try {
      const appsQ = query(collection(db, 'appointments'), where('clientId', '==', client.id));
      const txsQ = query(collection(db, 'transactions'), where('clientId', '==', client.id));
      const [appsSnap, txsSnap] = await Promise.all([getDocs(appsQ), getDocs(txsQ)]);
      const combined = [
        ...appsSnap.docs.map(d => ({ ...d.data(), type: 'service' })),
        ...txsSnap.docs.map(d => ({ ...d.data(), type: 'product' }))
      ].sort((a,b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
      setHistoryData(combined);
    } catch (error) { console.error(error); } finally { setLoadingHistory(false); }
  };

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm));

  return (
    <div className="space-y-12 pb-24 px-4 pt-4 bg-background min-h-screen lg:px-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end border-b border-white/5 pb-8">
        <div>
           <h2 className="industrial-header">Dossiê de <span className="metallic-gold">Clientes</span></h2>
           <p className="text-[10px] font-black text-muted uppercase tracking-[0.5em] mt-2 opacity-40">Client Database • {clients.length} Unidades</p>
        </div>
        <button onClick={() => { setEditingClient(null); setIsModalOpen(true); }} className="btn-accent px-10 py-5 rounded-3xl shadow-2xl flex items-center gap-3">
           <Plus className="w-6 h-6" /> Novo Cliente
        </button>
      </header>

      <div className="glass-card p-10 bg-secondary/20 border-white/5 flex items-center gap-6">
         <Search className="w-6 h-6 text-accent" />
         <input type="text" placeholder="LOCALIZAR POR NOME OU REGISTRO..." className="input-field py-5 bg-primary border-none shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredClients.map((client) => (
          <div key={client.id} className="glass-card group p-8 bg-secondary/20 border-white/5 hover:bg-secondary/40 transition-all relative overflow-hidden">
             <div className="flex justify-between items-start mb-8">
                <div className="w-16 h-16 rounded-[2rem] bg-accent/10 border border-accent/20 flex items-center justify-center font-black text-2xl text-accent shadow-2xl">{client.name?.[0]}</div>
                <div className="flex gap-2">
                   <a href={getWhatsAppLink(client.phone)} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-2xl bg-green-500/10 text-green-400 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all"><MessageCircle className="w-5 h-5" /></a>
                   <button onClick={() => handleHistory(client)} className="w-12 h-12 rounded-2xl bg-white/5 text-muted flex items-center justify-center hover:bg-accent hover:text-white transition-all"><Clock className="w-5 h-5" /></button>
                </div>
             </div>
             <div className="space-y-1">
                <h4 className="text-xl font-black text-text uppercase tracking-tighter truncate">{client.name}</h4>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">{formatPhone(client.phone)}</p>
             </div>
             <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center group-hover:border-accent/20 transition-all">
                <div className="flex items-center gap-2 text-[9px] font-black text-muted uppercase tracking-widest">
                   <Calendar className="w-4 h-4 text-accent" />
                   {client.birthDate ? format(new Date(client.birthDate), "dd MMM", { locale: ptBR }) : 'S/ Data'}
                </div>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => { setEditingClient(client); setFormData(client as any); setIsModalOpen(true); }} className="p-3 bg-white/5 rounded-xl text-muted hover:text-white"><Edit3 className="w-4 h-4" /></button>
                   <button onClick={async () => { if(confirm('Excluir?')) await deleteDoc(doc(db, 'clients', client.id)); }} className="p-3 bg-white/5 rounded-xl text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
             </div>
             {client.notes && (
               <div className="mt-6 flex gap-3 p-4 bg-primary/20 rounded-2xl border border-white/5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Info className="w-4 h-4 text-accent shrink-0" />
                  <p className="text-[10px] font-black uppercase text-muted leading-relaxed line-clamp-2">{client.notes}</p>
               </div>
             )}
          </div>
        ))}
      </div>

      {/* History Sidebar Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[150] flex justify-end">
           <div className="bg-primary/95 w-full max-w-xl h-full p-12 border-l border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] animate-in slide-in-from-right duration-500 overflow-y-auto">
              <button onClick={() => setViewingHistory(null)} className="absolute top-12 right-12 text-muted hover:text-white"><XCircle className="w-10 h-10" /></button>
              <div className="mb-16">
                 <h3 className="industrial-header text-4xl mb-4">{viewingHistory.name}</h3>
                 <p className="text-[10px] font-black text-accent uppercase tracking-[0.5em] opacity-60 italic">Profile Logs • Intelligence Center</p>
              </div>
              <div className="space-y-10">
                 {loadingHistory ? <div className="text-center py-20 text-muted uppercase font-black text-xs animate-pulse">Acessando Arquivos...</div> : 
                  historyData.map((item, i) => (
                   <div key={i} className="relative pl-10 border-l border-white/5 pb-10 last:pb-0">
                      <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-accent shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
                      <div className="glass-card p-6 bg-secondary/20 border-white/5">
                         <div className="flex justify-between items-start mb-4">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted">{format(new Date(item.date || item.createdAt), 'dd MMMM yyyy', { locale: ptBR })}</span>
                            <span className="text-lg font-black text-accent tracking-tighter">{formatCurrency(item.price || item.amount)}</span>
                         </div>
                         <h5 className="text-sm font-black text-text uppercase tracking-tighter mb-1">{item.service || item.description}</h5>
                         <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40">{item.type === 'service' ? 'Procedimento Executado' : 'Aquisição de Produto'}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* New/Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[150] flex items-center justify-center p-4">
           <div className="bg-primary/95 border border-white/10 rounded-[4rem] w-full max-w-xl p-12 shadow-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-12 right-12 text-muted hover:text-white"><XCircle className="w-8 h-8" /></button>
              <h3 className="industrial-header text-3xl mb-10">Ficha de <span className="metallic-gold">Registro</span></h3>
              <form onSubmit={handleSubmit} className="space-y-8">
                 <div className="space-y-6">
                    <label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2 block">Identificação e Contato</label>
                    <input required className="input-field py-5 bg-background border-white/5" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="NOME COMPLETO" />
                    <div className="grid grid-cols-2 gap-4">
                       <input required className="input-field py-5 bg-background border-white/5" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="TELEFONE" />
                       <input type="date" className="input-field py-5 bg-background border-white/5" value={formData.birthDate} onChange={(e) => setFormData({...formData, birthDate: e.target.value})} />
                    </div>
                    <textarea className="input-field py-5 bg-background border-white/5 min-h-[150px]" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="OBSERVAÇÕES E PREFERÊNCIAS..." />
                 </div>
                 <div className="flex gap-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Abortar</button>
                    <button type="submit" className="btn-accent flex-1">Finalizar Cadastro</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
