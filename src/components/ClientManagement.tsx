import React from 'react';
import { Plus, Search, Edit2, Trash2, Phone, Mail, Calendar, MessageCircle, Info, XCircle, User } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client } from '../types';
import { cn, formatPhone, getWhatsAppLink } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientManagement() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    email: '',
    birthDate: '',
    notes: ''
  });

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientData);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), formData);
      } else {
        await addDoc(collection(db, 'clients'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '', birthDate: '', notes: '' });
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      birthDate: client.birthDate || '',
      notes: client.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      await deleteDoc(doc(db, 'clients', id));
    }
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

  if (isMobile) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-[#FDFDFD] min-h-screen">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-text tracking-tighter uppercase">Meus Clientes</h2>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-none">Total: {clients.length} cadastrados</p>
        </header>

        {/* Search Bar Mobile */}
        <div className="mobile-card p-3 flex items-center gap-3 bg-white border border-secondary shadow-premium">
          <Search className="text-primary w-4 h-4 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou celular..." 
            className="bg-transparent flex-1 border-none focus:ring-0 text-xs font-bold text-text placeholder:text-muted p-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Client Cards List */}
        <div className="space-y-4">
          {filteredClients.length === 0 ? (
            <div className="mobile-card p-12 text-center text-muted italic text-sm">Nenhum cliente encontrado.</div>
          ) : (
            filteredClients.map((client) => (
              <div key={client.id} className="mobile-card p-4 border border-secondary/20 bg-white relative overflow-hidden group">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shadow-inner border border-primary/5 shrink-0">
                    {client.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-lg text-text truncate leading-tight uppercase tracking-tighter">{client.name}</h4>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-2 text-[10px] font-black text-muted lowercase">
                        <Phone className="w-3 h-3 text-accent" />
                        <span>{formatPhone(client.phone)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-muted lowercase">
                        <Calendar className="w-3 h-3 text-primary" />
                        <span>Aniver: {client.birthDate ? format(new Date(client.birthDate), "dd/MM", { locale: ptBR }) : 'Não info.'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-5 pt-4 border-t border-secondary/10">
                  <span className="text-[8px] font-black text-muted uppercase tracking-widest italic leading-none shrink-0">
                    {client.createdAt ? `Desde ${format(new Date(client.createdAt), "MM/yy")}` : ''}
                  </span>
                  <div className="flex gap-3">
                    <a 
                      href={getWhatsAppLink(client.phone, `Olá ${client.name}, tudo bem? Aqui é do Estúdio da Alê!`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-premium border border-green-100 transition-all active:scale-95"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </a>
                    <button onClick={() => handleEdit(client)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-premium border border-blue-100 active:scale-95">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(client.id)} className="w-10 h-10 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-premium border border-red-100 active:scale-95">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {client.notes && (
                  <div className="mt-3 p-2 bg-secondary/5 rounded-xl border border-secondary/10 text-[9px] font-bold text-muted italic flex items-center gap-2">
                    <Info className="w-3 h-3 shrink-0" />
                    <span className="truncate">{client.notes}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Floating Action Button */}
        <button 
          onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
          className="fab-button"
        >
          <Plus className="w-8 h-8" />
        </button>

        {renderModal()}
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-text tracking-tighter uppercase">Clientes</h2>
          <p className="text-muted mt-1 font-bold">Gerencie sua base de clientes e histórico de atendimentos.</p>
        </div>
        <button 
          onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
          className="btn-primary flex items-center gap-2 py-3 px-8 shadow-premium"
        >
          <Plus className="w-5 h-5" />
          Novo Cliente
        </button>
      </header>

      <div className="glass-card p-4 flex items-center gap-4 bg-white/70 shadow-premium border border-secondary/30">
        <Search className="text-primary w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou telefone..." 
          className="bg-transparent flex-1 border-none focus:ring-0 text-text placeholder:text-muted font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="glass-card overflow-x-auto shadow-premium border border-secondary/30">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-secondary/10 border-b border-secondary">
              <th className="px-6 py-4 font-black text-[10px] text-muted uppercase tracking-widest">Cliente</th>
              <th className="px-6 py-4 font-black text-[10px] text-muted uppercase tracking-widest">Contato</th>
              <th className="px-6 py-4 font-black text-[10px] text-muted uppercase tracking-widest">Aniversário</th>
              <th className="px-6 py-4 font-black text-[10px] text-muted uppercase tracking-widest">Observações</th>
              <th className="px-6 py-4 font-black text-[10px] text-muted uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary/30">
            {filteredClients.map((client) => (
              <tr key={client.id} className="hover:bg-secondary/5 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg border border-primary/5">
                      {client.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="font-black text-text truncate max-w-[150px] uppercase tracking-tighter">{client.name}</p>
                      <p className="text-[10px] font-black text-muted uppercase italic tracking-widest opacity-60">Desde {client.createdAt ? format(new Date(client.createdAt), "MMM yyyy", { locale: ptBR }) : 'Antigo'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black text-muted uppercase tracking-tighter">
                      <Phone className="w-3 h-3 text-accent" />
                      <span>{formatPhone(client.phone)}</span>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs font-black text-muted lowercase tracking-tighter">
                        <Mail className="w-3 h-3 text-primary" />
                        <span className="truncate max-w-[150px]">{client.email}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-xs font-black text-muted">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span>{client.birthDate ? format(new Date(client.birthDate), "dd/MM", { locale: ptBR }) : '—'}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-[200px] truncate text-xs font-bold text-muted italic">
                    {client.notes || 'Nenhuma observação'}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <a 
                      href={getWhatsAppLink(client.phone, `Olá ${client.name}, tudo bem? Aqui é do Estúdio da Alê!`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all active:scale-95 border border-green-100 shadow-sm"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </a>
                    <button onClick={() => handleEdit(client)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all active:scale-95 border border-blue-100 shadow-sm">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(client.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95 border border-red-100 shadow-sm">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              
              <h3 className="text-2xl font-black tracking-tighter mb-6 uppercase flex items-center gap-3">
                <User className="w-8 h-8 text-primary" />
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Nome Completo</label>
                    <input 
                      required
                      type="text" 
                      className="input-field py-3" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Telefone (DDD + Numero)</label>
                    <input 
                      required
                      type="text" 
                      className="input-field py-3" 
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Data de Nascimento</label>
                    <input 
                      type="date" 
                      className="input-field py-3" 
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Observações Privadas</label>
                    <textarea 
                      className="input-field min-h-[100px] py-3 text-xs" 
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Ex: Prefere tons nudes, Alérgica a esmalte X..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="btn-secondary text-xs font-black uppercase tracking-widest px-8"
                  >
                    Sair
                  </button>
                  <button type="submit" className="btn-primary text-xs font-black uppercase tracking-widest px-8">
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }
}
