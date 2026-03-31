import React from 'react';
import { Plus, Search, Filter, ArrowUpCircle, ArrowDownCircle, Banknote, Calendar, User, Trash2, Check, MessageSquare, Receipt, XCircle } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Client, Staff } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { format, isSameDay, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CashRegister() {
  const { user, profile, isAdmin } = useAuth();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedStaff, setSelectedStaff] = React.useState<string>('all');
  const [dateFilter, setDateFilter] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [noteValue, setNoteValue] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [formData, setFormData] = React.useState({
    type: 'income' as const,
    category: 'Serviço',
    amount: 0,
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    clientId: '',
    clientName: ''
  });

  React.useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    return () => unsubscribe();
  }, []);

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      const isMyTransaction = t.createdBy === user?.uid;
      const isAdminView = isAdmin || isMyTransaction;
      if (!isAdminView) return false;

      // Filtro de Data
      const tDateString = format(new Date(t.date || t.createdAt), 'yyyy-MM-dd');
      if (tDateString !== dateFilter) return false;

      // Filtro de Atendente
      if (selectedStaff === 'all') return true;
      if (selectedStaff === 'admin_alexandra') {
        return t.createdBy === user?.uid || (t.creatorName?.toLowerCase() || '').includes('alexandra');
      }
      const staffMember = staff.find(s => s.id === selectedStaff);
      const staffName = staffMember?.name?.toLowerCase() || '';
      return t.createdBy === selectedStaff || (t.creatorName?.toLowerCase() || '').includes(staffName);
    });
  }, [transactions, selectedStaff, dateFilter, isAdmin, user, staff]);

  const totals = React.useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const amount = Number(t.amount) || 0;
      if (t.type === 'income') acc.income += amount;
      else acc.expense += amount;
      acc.balance = acc.income - acc.expense;
      return acc;
    }, { income: 0, expense: 0, balance: 0 });
  }, [filteredTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const client = clients.find(c => c.id === formData.clientId);
      const transactionDate = new Date(`${formData.date}T12:00:00`);

      await addDoc(collection(db, 'transactions'), {
        ...formData,
        date: transactionDate.toISOString(),
        clientName: client?.name || '',
        createdAt: new Date().toISOString(),
        createdBy: user?.uid,
        creatorName: profile?.name || user?.email?.split('@')[0] || 'Atendente'
      });
      setIsModalOpen(false);
      setFormData({ type: 'income', category: 'Serviço', amount: 0, description: '', date: format(new Date(), 'yyyy-MM-dd'), clientId: '', clientName: '' });
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const handleToggleVerify = async (id: string, current: boolean) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'transactions', id), { isVerified: !current });
  };

  const handleSaveObservation = async (id: string) => {
    await updateDoc(doc(db, 'transactions', id), { observation: noteValue });
    setEditingNoteId(null);
    setNoteValue('');
  };

  if (isMobile) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4 min-h-screen bg-[#FDFDFD]">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-text tracking-tighter uppercase">Caixa</h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-muted" />
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase text-muted focus:ring-0 p-0" />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <div className="mobile-card p-4 border-l-4 border-green-500 bg-green-50/20">
            <p className="text-[9px] font-black text-green-600 uppercase mb-1">Entradas</p>
            <h4 className="text-lg font-black text-text">{formatCurrency(totals.income)}</h4>
          </div>
          <div className="mobile-card p-4 border-l-4 border-red-500 bg-red-50/20">
            <p className="text-[9px] font-black text-red-600 uppercase mb-1">Saídas</p>
            <h4 className="text-lg font-black text-text">{formatCurrency(totals.expense)}</h4>
          </div>
          <div className="mobile-card p-4 border-l-4 border-accent bg-accent/5 col-span-2">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black text-accent uppercase mb-1">Saldo do Filtro</p>
                <h4 className="text-xl font-black text-text">{formatCurrency(totals.balance)}</h4>
              </div>
              <Receipt className="w-6 h-6 text-accent/30" />
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="mobile-card p-3 bg-white border border-secondary/20 shadow-premium">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase text-text focus:ring-0 w-full">
                <option value="all">Filtro: Todos</option>
                <option value="admin_alexandra">Alexandra (Eu)</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-xs font-black text-muted uppercase tracking-widest px-1">Movimentações</h3>
          {filteredTransactions.length === 0 ? (
            <div className="mobile-card p-12 text-center text-muted italic text-sm">Nenhum lançamento para esta data.</div>
          ) : (
            filteredTransactions.map(t => (
              <div key={t.id} className="mobile-card p-4 relative overflow-hidden group border border-secondary/20 bg-white">
                {t.isVerified && <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500" />}
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-3">
                     <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", t.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                       {t.type === 'income' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
                     </div>
                     <div>
                       <p className="text-[10px] font-black uppercase text-muted mb-0.5">{t.category}</p>
                       <h5 className="font-bold text-sm text-text truncate max-w-[150px]">{t.description}</h5>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className={cn("font-black text-sm", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                     </p>
                     <span className="text-[9px] font-bold text-muted italic opacity-60">{format(new Date(t.date || t.createdAt), 'HH:mm')}</span>
                   </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-secondary/10">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/5 text-primary text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">{t.creatorName?.split(' ')[0] || 'Atend'}</span>
                    {t.clientName && <span className="text-[9px] text-muted italic">Cli: {t.clientName.split(' ')[0]}</span>}
                  </div>
                  <div className="flex gap-2">
                    {isAdmin && <button onClick={() => handleToggleVerify(t.id, !!t.isVerified)} className={cn("p-2 rounded-xl transition-all", t.isVerified ? "bg-green-100 text-green-600" : "bg-white shadow-premium")}><Check className="w-4 h-4" /></button>}
                    <button onClick={() => { setEditingNoteId(t.id); setNoteValue(t.observation || ''); }} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl"><MessageSquare className="w-4 h-4" /></button>
                    {isAdmin && (
                      deleteConfirm === t.id ? (
                        <button onClick={async () => { await deleteDoc(doc(db, 'transactions', t.id)); setDeleteConfirm(null); }} className="p-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase">EXCLUIR?</button>
                      ) : (
                        <button onClick={() => setDeleteConfirm(t.id)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                      )
                    )}
                  </div>
                </div>
                {editingNoteId === t.id && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-2xl flex gap-2">
                    <input autoFocus className="input-field py-1.5 text-xs" value={noteValue} onChange={e => setNoteValue(e.target.value)} />
                    <button onClick={() => handleSaveObservation(t.id)} className="btn-primary py-1.5 px-3 text-[10px]">SALVAR</button>
                  </div>
                )}
                {t.observation && editingNoteId !== t.id && (
                  <div className="mt-2 text-[9px] text-yellow-800 bg-yellow-100/30 p-2 rounded-lg italic">Obs: {t.observation}</div>
                )}
              </div>
            ))
          )}
        </div>
        <button onClick={() => setIsModalOpen(true)} className="fab-button"><Plus className="w-8 h-8" /></button>
        {renderModal()}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white rounded-xl border border-secondary shadow-sm p-4 gap-4">
             <div className="flex items-center gap-2">
               <Calendar className="w-4 h-4 text-primary" />
               <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-transparent border-none text-xs font-black uppercase text-text focus:ring-0 p-0" />
             </div>
             {isAdmin && (
               <div className="flex items-center gap-2 border-l border-secondary pl-4">
                 <User className="w-4 h-4 text-primary" />
                 <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="bg-transparent border-none text-xs font-black uppercase text-text focus:ring-0 p-0">
                    <option value="all">TODOS ATENDENTES</option>
                    <option value="admin_alexandra">EU (ALEXANDRA)</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                 </select>
               </div>
             )}
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2 px-8 py-3 shadow-premium hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"><Plus className="w-5 h-5" />Novo Lançamento</button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-green-500 bg-green-50/10">
          <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">Entradas do Filtro</p>
          <h3 className="text-3xl font-black text-text">{formatCurrency(totals.income)}</h3>
        </div>
        <div className="glass-card p-6 border-l-4 border-red-500 bg-red-50/10">
          <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">Saídas do Filtro</p>
          <h3 className="text-3xl font-black text-text">{formatCurrency(totals.expense)}</h3>
        </div>
        <div className="glass-card p-6 border-l-4 border-accent bg-accent/5">
          <p className="text-xs font-black text-accent uppercase tracking-widest mb-2">Saldo Líquido</p>
          <h3 className="text-3xl font-black text-text">{formatCurrency(totals.balance)}</h3>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/10 border-b border-secondary">
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Status</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Data/Hora</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Categoria</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Descrição</th>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Atendente</th>
              <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-muted">Valor</th>
              <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-muted">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(t => (
              <tr key={t.id} className="border-b border-secondary/50 hover:bg-secondary/5 transition-colors">
                <td className="p-4">
                  {isAdmin ? (
                    <button onClick={() => handleToggleVerify(t.id, !!t.isVerified)}>
                      <Check className={cn("w-5 h-5", t.isVerified ? "text-green-500" : "text-secondary")} />
                    </button>
                  ) : <Check className={cn("w-5 h-5", t.isVerified ? "text-green-500" : "text-secondary")} />}
                </td>
                <td className="p-4 text-xs font-bold text-text">{format(new Date(t.date || t.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                <td className="p-4">
                   <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase", t.type === 'income' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{t.category}</span>
                </td>
                <td className="p-4">
                  <p className="text-sm font-bold text-text">{t.description}</p>
                  {t.clientName && <p className="text-[10px] text-muted font-bold">Cliente: {t.clientName}</p>}
                </td>
                <td className="p-4 text-xs font-bold text-muted uppercase">{t.creatorName || 'Atendente'}</td>
                <td className="p-4 text-right">
                  <span className={cn("text-sm font-black", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditingNoteId(t.id); setNoteValue(t.observation || ''); }} className="p-2 hover:bg-yellow-50 text-yellow-600 rounded-xl transition-colors"><MessageSquare className="w-4 h-4" /></button>
                    {isAdmin && (
                      deleteConfirm === t.id ? (
                        <button onClick={async () => { await deleteDoc(doc(db, 'transactions', t.id)); setDeleteConfirm(null); }} className="p-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase">EXCLUIR?</button>
                      ) : (
                        <button onClick={() => setDeleteConfirm(t.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                      )
                    )}
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
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-secondary/20 rounded-full transition-colors"><XCircle className="w-6 h-6 text-muted" /></button>
              <h3 className="text-2xl font-black tracking-tighter mb-6 uppercase">Novo Lançamento</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2 flex bg-secondary/10 p-1 rounded-2xl">
                     <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={cn("flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all", formData.type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-muted")}>Entrada</button>
                     <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={cn("flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all", formData.type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-muted")}>Saída</button>
                   </div>
                   <div className="col-span-2">
                     <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Descrição</label>
                     <input required className="input-field" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Ex: Pagamento Fornecedor" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Valor</label>
                     <input required type="number" step="0.01" className="input-field" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Data</label>
                     <input required type="date" className="input-field" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                   </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs font-black uppercase">Sair</button>
                  <button type="submit" className="btn-primary text-xs font-black uppercase">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }
}
