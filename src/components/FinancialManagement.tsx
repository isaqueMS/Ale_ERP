import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, TrendingUp, TrendingDown, DollarSign, Filter, Trash2, 
  Edit3, Calendar, PieChart, Download, X, Search, User, FileText,
  ChevronDown, ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import { 
  collection, query, onSnapshot, addDoc, 
  deleteDoc, doc, updateDoc, orderBy, 
  where, Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction, Appointment, Staff } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';

export default function FinancialManagement() {
  const { isAdmin, user: currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    professionalId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubT = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    const unsubA = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    });

    const unsubS = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    return () => { unsubT(); unsubA(); unsubS(); };
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      try {
        const tDate = parseISO(t.date);
        const inRange = isWithinInterval(tDate, {
          start: new Date(startDate + 'T00:00:00'),
          end: new Date(endDate + 'T23:59:59')
        });
        
        const matchesType = filterType === 'all' || t.type === filterType;
        const search = searchTerm.toLowerCase();
        const matchesSearch = search === '' || 
          (t.description || '').toLowerCase().includes(search) ||
          (t.category || '').toLowerCase().includes(search) ||
          (t.creatorName || '').toLowerCase().includes(search);

        const profId = t.professionalId || t.creatorId;
        const matchesStaff = selectedStaff === 'all' || profId === selectedStaff;
        return inRange && matchesType && matchesSearch && matchesStaff;
      } catch (e) {
        return false;
      }
    });
  }, [transactions, filterType, startDate, endDate, searchTerm, selectedStaff]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const amount = Number(t.amount) || 0;
      if (t.type === 'income') acc.income += amount;
      else acc.expense += amount;
      acc.balance = acc.income - acc.expense;
      return acc;
    }, { income: 0, expense: 0, balance: 0 });
  }, [filteredTransactions]);

  const staffCommissions = useMemo(() => {
    return staff.map(s => {
      const periodAppointments = appointments.filter(a => 
        a.staffId === s.id && 
        a.status === 'completed' &&
        isWithinInterval(parseISO(a.date), {
          start: new Date(startDate + 'T00:00:00'),
          end: new Date(endDate + 'T23:59:59')
        })
      );

      const totalRevenue = periodAppointments.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      const totalCommission = periodAppointments.reduce((sum, a) => sum + (Number(a.commissionAmount) || 0), 0);
      const netProfit = totalRevenue - totalCommission;
      
      return {
        id: s.id,
        name: s.name,
        percentage: s.commission || 0,
        count: periodAppointments.length,
        totalRevenue,
        totalCommission,
        netProfit
      };
    }).filter(s => selectedStaff === 'all' || s.id === selectedStaff);
  }, [staff, appointments, startDate, endDate, selectedStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        amount: Number(formData.amount),
        creatorId: currentUser?.uid || 'admin',
        creatorName: currentUser?.name || 'Admin Alexandra',
        professionalId: formData.professionalId || '',
        createdAt: new Date().toISOString()
      };
      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), data);
      } else {
        await addDoc(collection(db, 'transactions'), data);
      }
      setIsModalOpen(false);
      setEditingTransaction(null);
      setFormData({ type: 'income', category: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), description: '', professionalId: '' });
    } catch (error) {
      console.error("Error saving transaction:", error);
      alert("Erro ao salvar lançamento.");
    }
  };

  if (!isAdmin) return <div className="p-20 text-center font-bold text-slate-400 uppercase tracking-widest animate-fade-in">Acesso Restrito ao Painel de Administração</div>;

  return (
    <div className="space-y-10 pb-20 animate-fade-up">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <div className="w-1.5 h-6 bg-[#FFB6C1] rounded-full shadow-[0_0_10px_rgba(255,182,193,0.5)]" />
             <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight uppercase">Contabilidade Geral</h2>
           </div>
           <p className="text-slate-400 font-bold text-xs sm:text-sm ml-3 uppercase tracking-widest">Gestão e controle do seu Studio</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full sm:w-auto h-14 px-8 rounded-2xl flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> Novo Lançamento
        </button>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
         <div className="flex-1 bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-sm border border-pink-50 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-2 text-slate-800 font-black uppercase text-xs tracking-[0.2em]">
                 <Filter className="w-4 h-4 text-[#FFB6C1]" /> Central de Inteligência
               </div>
               <div className="flex items-center gap-2 bg-[#FFFDFB] px-5 py-3 rounded-2xl border border-pink-50 shadow-sm">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-black text-slate-600 outline-none" />
                  <span className="text-xs font-bold text-slate-300">até</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-black text-slate-600 outline-none" />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#FFB6C1] transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Buscar transação..." 
                    className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] py-4 pl-14 pr-4 text-xs font-bold outline-none focus:bg-white focus:border-pink-50 transition-all placeholder:text-slate-300"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
               <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#FFB6C1] transition-colors" />
                  <select 
                    className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] py-4 pl-14 pr-4 text-xs font-bold outline-none focus:bg-white focus:border-pink-50 appearance-none cursor-pointer transition-all"
                    value={selectedStaff}
                    onChange={e => setSelectedStaff(e.target.value)}
                  >
                    <option value="all">Filtro por Atendente (Todas)</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
               {['all', 'income', 'expense'].map((t) => (
                 <button 
                  key={t}
                  onClick={() => setFilterType(t as any)}
                  className={cn(
                    "px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                    filterType === t 
                      ? "bg-[#FFB6C1] text-white shadow-lg shadow-pink-100" 
                      : "bg-slate-50 text-slate-400 hover:bg-pink-50/50"
                  )}
                 >
                   {t === 'all' ? 'Tudo' : t === 'income' ? 'Receitas' : 'Despesas'}
                 </button>
               ))}
            </div>
         </div>

         <div className="lg:w-96 space-y-4">
            <SummaryPillar title="ENTRADAS" value={totals.income} color="text-emerald-500" icon={TrendingUp} />
            <SummaryPillar title="SAÍDAS" value={totals.expense} color="text-red-400" icon={TrendingDown} />
            <SummaryPillar title="SALDO ESTÜDIO" value={totals.balance} color="text-slate-800" icon={DollarSign} isMain />
         </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-2 ml-4">
           <Clock className="w-5 h-5 text-amber-500" />
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Divisão de Ganhos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {staffCommissions.map(s => (
             <div key={s.id} className="card-premium p-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:bg-pink-50/50 transition-colors" />
                <div className="relative h-full flex flex-col justify-between">
                   <div className="mb-10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-[#FFB6C1] uppercase tracking-widest">Profissional</span>
                        <div className="h-0.5 flex-1 bg-slate-50" />
                      </div>
                      <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-1">{s.name}</h4>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{s.count} ATENDIMENTOS CONCLUÍDOS</p>
                   </div>

                   <div className="space-y-5 mb-10">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento</span>
                         <span className="text-sm font-black text-emerald-500 font-mono">{formatCurrency(s.totalRevenue)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comissão ({s.percentage}%)</span>
                         <span className="text-sm font-black text-amber-500 font-mono">{formatCurrency(s.totalCommission)}</span>
                      </div>
                   </div>

                   <div className="pt-6 border-t border-slate-50">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Lucro Líquido</span>
                         <span className="text-2xl font-black text-slate-800 font-mono tracking-tighter">{formatCurrency(s.netProfit)}</span>
                      </div>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </section>

      <div className="card-premium p-0 overflow-hidden">
        <div className="p-10 border-b border-slate-50 bg-[#FFFDFB] flex flex-col md:flex-row justify-between items-center gap-4">
           <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
             <FileText className="w-5 h-5 text-[#FFB6C1]" /> Histórico de Transações
           </h3>
           <div className="flex gap-4">
              <button onClick={() => window.print()} className="bg-white border-2 border-slate-50 hover:border-pink-100 p-3 rounded-2xl transition-all shadow-sm">
                <Download className="w-5 h-5 text-slate-400" />
              </button>
           </div>
        </div>
        <div className="responsive-table-container">
           <table className="w-full min-w-[1000px]">
              <thead>
                 <tr className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] bg-slate-50/30">
                   <th className="px-10 py-6 text-left">Data</th>
                   <th className="px-10 py-6 text-left">Categoria / Descrição</th>
                   <th className="px-10 py-6 text-left">Atendente</th>
                   <th className="px-10 py-6 text-right">Valor Líquido</th>
                   <th className="px-10 py-6 text-center">Ações</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {filteredTransactions.map(t => {
                   const professional = staff.find(s => s.id === (t.professionalId || t.creatorId));
                   return (
                    <tr key={t.id} className="hover:bg-pink-50/20 transition-all group">
                       <td className="px-10 py-6">
                          <p className="text-xs font-black text-slate-800">{format(parseISO(t.date), 'dd/MM/yyyy')}</p>
                          <p className="text-[9px] font-bold text-slate-300 uppercase mt-0.5">{format(parseISO(t.date), 'EEEE', { locale: ptBR })}</p>
                       </td>
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-1.5 h-6 rounded-full", t.type === 'income' ? 'bg-emerald-400' : 'bg-red-400')} />
                            <div>
                               <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{t.category}</p>
                               <p className="text-[10px] font-bold text-slate-400 mt-1">{t.description || 'Consulta Avulsa'}</p>
                            </div>
                          </div>
                       </td>
                       <td className="px-10 py-6">
                          <span className="bg-[#FFFDFB] border border-pink-50 text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-xl">@{professional?.name?.split(' ')[0] || 'Studio'}</span>
                       </td>
                       <td className="px-10 py-6 text-right font-mono font-black text-base">
                          <span className={t.type === 'income' ? 'text-emerald-500' : 'text-red-400'}>
                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                          </span>
                       </td>
                       <td className="px-10 py-6">
                          <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                             <button onClick={() => { setEditingTransaction(t); setFormData(t as any); setIsModalOpen(true); }} className="p-3 bg-white shadow-lg border border-pink-50 rounded-2xl text-slate-400 hover:text-[#FFB6C1] transition-all scale-90 hover:scale-100"><Edit3 className="w-4 h-4" /></button>
                             <button onClick={() => setDeleteConfirm(t.id)} className="p-3 bg-white shadow-lg border border-pink-50 rounded-2xl text-slate-400 hover:text-red-400 transition-all scale-90 hover:scale-100"><Trash2 className="w-4 h-4" /></button>
                          </div>
                       </td>
                    </tr>
                 )})}
              </tbody>
           </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-center mb-6 shrink-0 pr-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{editingTransaction ? 'Ajustar' : 'Novo'} Lançamento</h3>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Controle financeiro do Studio.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl shadow-inner mb-2">
                   <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", formData.type === 'income' ? "bg-white text-emerald-500 shadow-md scale-[1.02]" : "text-slate-400 opacity-60 hover:opacity-100")}>Entrada</button>
                   <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", formData.type === 'expense' ? "bg-white text-red-500 shadow-md scale-[1.02]" : "text-slate-400 opacity-60 hover:opacity-100")}>Saída</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Categoria / Grupo</label>
                      <input required className="input-premium !py-3 !px-5 shadow-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Ex: Aluguel, Pro-labore..." />
                   </div>
                   <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Atribuído (Opcional)</label>
                      <select className="select-premium !py-3 !px-5 text-[10px] uppercase tracking-widest" value={formData.professionalId || ''} onChange={e => setFormData({...formData, professionalId: e.target.value})}>
                         <option value="">Studio (Geral)</option>
                         {staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                      </select>
                   </div>
                </div>
    
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="relative pt-1.5">
                      <label className="floating-label">Valor do Lançamento (R$)</label>
                      <input required type="number" step="0.01" className="input-premium font-mono !py-3 !px-5 shadow-sm" placeholder="0,00" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                   </div>
                   <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Data da Operação</label>
                      <input required type="date" className="input-premium !py-3 !px-5 font-black uppercase text-[10px] shadow-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                   </div>
                </div>
                
                <div className="relative pt-1.5 font-sans mb-4">
                   <label className="label-premium !text-[9px] !mb-1.5">Descrição / Justificativa</label>
                   <textarea className="textarea-premium h-24 shadow-inner" placeholder="Pequena nota para justificar o lançamento no livro caixa..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <button type="submit" className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black group shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                   {editingTransaction ? 'Registrar Ajuste' : 'Confirmar Lançamento'} <DollarSign className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center space-y-8 animate-fade-up border border-pink-50">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg border border-red-100"><Trash2 className="w-10 h-10" /></div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Remover Lançamento?</h3>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 rounded-2xl font-black text-slate-400 uppercase text-xs tracking-widest hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={async () => { await deleteDoc(doc(db, 'transactions', deleteConfirm)); setDeleteConfirm(null); }} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black uppercase text-xs tracking-widest shadow-xl hover:bg-red-600 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPillar({ title, value, color, icon: Icon, isMain }: any) {
  return (
    <div className={cn(
      "p-8 rounded-[2.5rem] border transition-all flex flex-col justify-between h-36 relative overflow-hidden group hover:scale-[1.03]",
      isMain ? "bg-slate-800 border-transparent text-white shadow-2xl shadow-slate-200" : "bg-white border-pink-50 text-slate-800 shadow-sm"
    )}>
       {isMain && <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFB6C1] rounded-full -mr-16 -mt-16 blur-2xl opacity-20" />}
       <p className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isMain ? "text-pink-200" : "text-slate-400")}>{title}</p>
       <div className="flex items-end justify-between">
          <p className={cn("text-3xl font-black font-mono tracking-tighter", isMain ? "text-white" : color)}>
            {formatCurrency(value)}
          </p>
          <Icon className={cn("w-6 h-6", isMain ? "text-[#FFB6C1]" : "text-slate-200")} />
       </div>
    </div>
  );
}
