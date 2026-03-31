import React from 'react';
import { 
  Plus, Search, ArrowUpCircle, ArrowDownCircle, DollarSign, PieChart, 
  TrendingUp, TrendingDown, Filter, Trash2, Edit2, X, CheckCircle, 
  MessageSquare, Check, Edit3, Clock, Calendar, BarChart2, AlertCircle 
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Appointment, Staff } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, eachMonthOfInterval, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';

export default function FinancialManagement() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState<'all' | 'income' | 'expense' | 'commissions'>('all');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  const [formData, setFormData] = React.useState({
    type: 'income' as const,
    category: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });
  const [selectedStaff, setSelectedStaff] = React.useState('all');
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [noteValue, setNoteValue] = React.useState('');
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  const COLORS = ['#FFB7C5', '#F5E6D3', '#D4AF37', '#E6E6FA', '#F0FFF0', '#FFF0F5'];

  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;

    const q = query(
      collection(db, 'transactions'), 
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    });

    const qAppointments = query(
      collection(db, 'appointments'),
      where('date', '>=', start),
      where('date', '<=', end)
    );
    const unsubscribeAppointments = onSnapshot(qAppointments, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(data);
    });

    const unsubscribeStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      setStaff(data);
    });

    return () => {
      unsubscribe();
      unsubscribeAppointments();
      unsubscribeStaff();
    };
  }, [startDate, endDate]);

  const totals = React.useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        date: new Date(formData.date).toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid || 'unknown',
        creatorName: profile?.name || 'Administrador'
      };

      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), data);
      } else {
        await addDoc(collection(db, 'transactions'), { ...data, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
      setEditingTransaction(null);
      setFormData({ type: 'income', category: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), description: '' });
    } catch (error) { console.error(error); }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.category.toLowerCase().includes(searchTerm.toLowerCase()) || (t.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    let matchesStaff = true;
    if (selectedStaff !== 'all') {
      matchesStaff = t.createdBy === selectedStaff || (t.creatorName || '').toLowerCase().includes(selectedStaff.toLowerCase());
    }
    return matchesSearch && matchesType && matchesStaff;
  });

  const staffCommissions = React.useMemo(() => {
    const commissions: { [key: string]: { name: string; total: number; count: number } } = {};
    staff.forEach(s => { commissions[s.id] = { name: s.name, total: 0, count: 0 }; });
    appointments.filter(a => a.status === 'completed').forEach(a => {
      if (commissions[a.staffId]) {
        commissions[a.staffId].total += a.commissionAmount || 0;
        commissions[a.staffId].count += 1;
      }
    });
    return Object.entries(commissions).map(([id, data]) => ({ id, ...data }));
  }, [staff, appointments]);

  if (!isAdmin) return <div className="p-20 text-center font-black uppercase text-muted tracking-widest">Acesso Restrito Admin</div>;

  return (
    <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-[#FDFDFD] min-h-screen lg:px-8">
      <header className="flex flex-col lg:flex-row justify-between items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-3xl font-black text-text tracking-tighter uppercase">Gestão Financeira</h2>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">Controle de faturamento e lucro</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full lg:w-auto py-4 px-8 flex items-center justify-center gap-2 shadow-premium">
           <Plus className="w-5 h-5" /> Nova Transação
        </button>
      </header>

      {/* Totals Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <FinancialCard title="Receitas" value={totals.income} icon={TrendingUp} color="bg-green-500" trend="+8%" />
         <FinancialCard title="Despesas" value={totals.expense} icon={TrendingDown} color="bg-red-500" trend="-2%" />
         <FinancialCard title="Saldo Final" value={totals.balance} icon={DollarSign} color="bg-accent" />
      </div>

      {/* Date Filters Mobile */}
      <div className="mobile-card p-4 bg-white border border-secondary shadow-premium flex flex-col gap-3">
         <div className="flex items-center gap-2 border-b border-secondary/10 pb-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest">Filtrar Período</span>
         </div>
         <div className="grid grid-cols-2 gap-3 items-center">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-secondary/5 border-none rounded-xl p-3 text-[10px] font-black uppercase" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-secondary/5 border-none rounded-xl p-3 text-[10px] font-black uppercase" />
         </div>
         <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
            <Filter className="w-4 h-4 text-primary" />
            <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase flex-1 focus:ring-0">
               <option value="all">TODOS ATENDENTES</option>
               {staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
            </select>
         </div>
      </div>

      {/* List / Cards for Transactions */}
      <div className="space-y-4">
         <div className="flex justify-between items-center px-1">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-widest">Últimas Movimentações</h3>
            <div className="flex gap-2">
               <button onClick={() => setFilterType('all')} className={cn("text-[9px] font-black uppercase px-3 py-1 rounded-full", filterType === 'all' ? "bg-primary text-white" : "bg-secondary/20 text-muted")}>Tudo</button>
               <button onClick={() => setFilterType('income')} className={cn("text-[9px] font-black uppercase px-3 py-1 rounded-full", filterType === 'income' ? "bg-green-500 text-white" : "bg-secondary/20 text-muted")}>Rec.</button>
               <button onClick={() => setFilterType('expense')} className={cn("text-[9px] font-black uppercase px-3 py-1 rounded-full", filterType === 'expense' ? "bg-red-500 text-white" : "bg-secondary/20 text-muted")}>Desp.</button>
            </div>
         </div>

         {filteredTransactions.map(t => (
           <div key={t.id} className="mobile-card p-4 bg-white border border-secondary/20 flex justify-between items-center group active:scale-95 transition-all shadow-premium border-l-4" style={{ borderLeftColor: t.type === 'income' ? '#22c55e' : '#ef4444' }}>
              <div className="flex gap-3 items-center">
                 <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center font-black text-text border border-secondary/20">
                    {t.type === 'income' ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                 </div>
                 <div>
                    <h4 className="text-[11px] font-black text-text uppercase tracking-tight">{t.category}</h4>
                    <p className="text-[9px] font-bold text-muted italic">{t.description || 'Sem descrição'}</p>
                    <div className="flex items-center gap-1 mt-1">
                       <span className="text-[8px] font-black uppercase text-primary/60">{t.creatorName?.split(' ')[0]}</span>
                       <span className="text-[8px] font-bold text-muted">• {format(new Date(t.date), 'dd/MM')}</span>
                    </div>
                 </div>
              </div>
              <div className="text-right">
                 <p className={cn("text-xs font-black", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                 </p>
                 <div className="flex gap-1 justify-end mt-2">
                    <button onClick={() => { setEditingTransaction(t); setFormData({ type: t.type, category: t.category, amount: t.amount, date: format(new Date(t.date), 'yyyy-MM-dd'), description: t.description || '' }); setIsModalOpen(true); }} className="p-1.5 bg-secondary/10 rounded-lg text-text"><Edit3 className="w-3 h-3" /></button>
                    {deleteConfirm === t.id ? (
                      <button onClick={async () => { await deleteDoc(doc(db, 'transactions', t.id)); setDeleteConfirm(null); }} className="p-1.5 bg-red-500 rounded-lg text-white font-black text-[9px] uppercase animate-in fade-in zoom-in">EXCLUIR?</button>
                    ) : (
                      <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 bg-red-50 rounded-lg text-red-500"><Trash2 className="w-3 h-3" /></button>
                    )}
                 </div>
              </div>
           </div>
         ))}
      </div>

      {/* Commission Cards */}
      <div className="pt-8 border-t border-secondary/20">
         <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-6 px-1 flex items-center gap-2"><PieChart className="w-4 h-4 text-accent" /> Comissões por Profissional</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffCommissions.map(s => (
               <div key={s.id} className="mobile-card p-5 bg-white border border-secondary shadow-premium relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-accent/5 rounded-bl-3xl flex items-center justify-center font-black text-accent/30">{s.name?.[0]}</div>
                  <h4 className="text-xs font-black text-text uppercase tracking-tighter mb-1">{s.name}</h4>
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{s.count} Serviços</p>
                  <div className="mt-4 pt-4 border-t border-secondary/10 flex justify-between items-end">
                     <div>
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Total a Pagar</p>
                        <p className="text-lg font-black text-accent leading-none">{formatCurrency(s.total)}</p>
                     </div>
                     <button className="p-2 bg-accent/10 rounded-xl text-accent active:scale-90 transition-all"><ArrowUpCircle className="w-4 h-4" /></button>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => {setIsModalOpen(false); setEditingTransaction(null);}} className="absolute top-8 right-8 p-2 hover:bg-secondary/20 rounded-full transition-colors"><X className="w-6 h-6 text-muted" /></button>
            <h3 className="text-2xl font-black tracking-tighter mb-8 uppercase flex items-center gap-3"><DollarSign className="w-8 h-8 text-primary" /> {editingTransaction ? 'Editar' : 'Lançar'} Valor</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="flex bg-secondary/10 p-1 rounded-2xl">
                  <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-muted")}>Receita</button>
                  <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-muted")}>Despesa</button>
               </div>
               <div className="space-y-4">
                  <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Categoria</label><input required className="input-field py-4 font-bold" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="Ex: Produto, Luz, Aluguel" /></div>
                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Valor (R$)</label><input required type="number" step="0.01" className="input-field py-4 font-bold" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} /></div>
                     <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Data</label><input required type="date" className="input-field py-4 font-bold" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
                  </div>
                  <div><label className="text-[10px] font-black text-muted uppercase ml-2 mb-1 block">Descrição Adicional</label><textarea className="input-field min-h-[100px] py-4 font-bold" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
               </div>
               <button type="submit" className="w-full btn-primary py-5 text-xs font-black uppercase tracking-widest rounded-3xl shadow-lg shadow-primary/20">Salvar Lançamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FinancialCard({ title, value, icon: Icon, color, trend }: any) {
  return (
    <div className="mobile-card p-6 bg-white border border-secondary shadow-premium relative overflow-hidden group">
      <div className={cn("absolute top-0 right-0 w-16 h-16 opacity-5 rounded-bl-[4rem]", color)} />
      <div className="flex justify-between items-start">
         <div className={cn("p-3 rounded-2xl text-white shadow-lg", color)}><Icon className="w-6 h-6" /></div>
         {trend && <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full uppercase", trend.includes('+') ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{trend}</span>}
      </div>
      <div className="mt-6">
         <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">{title}</p>
         <h3 className="text-2xl font-black text-text tracking-tighter leading-none">{formatCurrency(value)}</h3>
      </div>
    </div>
  );
}
