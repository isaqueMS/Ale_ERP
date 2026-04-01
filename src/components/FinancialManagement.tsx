import React from 'react';
import { 
  Plus, Search, ArrowUpCircle, ArrowDownCircle, DollarSign, PieChart, 
  TrendingUp, TrendingDown, Filter, Trash2, Edit3, X, Clock, Calendar, BarChart2
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Appointment, Staff } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function FinancialManagement() {
  const { user, profile, isAdmin } = useAuth();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState<'all' | 'income' | 'expense'>('all');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  const [formData, setFormData] = React.useState({ type: 'income' as const, category: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), description: '' });
  const [selectedStaff, setSelectedStaff] = React.useState('all');
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    onSnapshot(collection(db, 'transactions'), (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))));
    onSnapshot(collection(db, 'appointments'), (snap) => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))));
    onSnapshot(collection(db, 'staff'), (snap) => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff))));
  }, []);

  const totals = React.useMemo(() => {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;
    const filtered = transactions.filter(t => (t.date || t.createdAt) >= start && (t.date || t.createdAt) <= end);
    const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return { income, expense, balance: income - expense };
  }, [transactions, startDate, endDate]);

  const filteredTransactions = React.useMemo(() => {
    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;
    return transactions.filter(t => {
      const tDate = t.date?.includes('T') ? t.date : `${t.date}T00:00:00.000Z`;
      const matchesSearch = t.category.toLowerCase().includes(searchTerm.toLowerCase()) || (t.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      return tDate >= start && tDate <= end && matchesSearch && matchesType;
    }).sort((a,b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
  }, [transactions, startDate, endDate, searchTerm, filterType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...formData, date: new Date(formData.date).toISOString(), updatedAt: new Date().toISOString(), createdBy: user?.uid, creatorName: profile?.name || 'Admin' };
      if (editingTransaction) await updateDoc(doc(db, 'transactions', editingTransaction.id), data);
      else await addDoc(collection(db, 'transactions'), { ...data, createdAt: new Date().toISOString() });
      setIsModalOpen(false);
      setEditingTransaction(null);
    } catch (error) { console.error(error); }
  };

  if (!isAdmin) return <div className="p-20 text-center industrial-header text-muted text-xl">Acesso Negado</div>;

  return (
    <div className="space-y-12 pb-24 px-4 pt-4 bg-background min-h-screen lg:px-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row justify-between items-start gap-8 border-b border-white/5 pb-8">
        <div>
           <h2 className="industrial-header">Terminal <span className="metallic-gold">Financeiro</span></h2>
           <p className="text-[10px] font-black text-muted uppercase tracking-[0.5em] mt-2 opacity-40">Financial Operations Center</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-accent px-10 py-5 rounded-3xl shadow-2xl flex items-center gap-3">
           <Plus className="w-6 h-6" /> Novo Lançamento
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <FinancialCard title="Total Receitas" value={totals.income} icon={TrendingUp} color="bg-green-500/20 text-green-400" trend="+12.4%" />
         <FinancialCard title="Total Despesas" value={totals.expense} icon={TrendingDown} color="bg-red-500/20 text-red-400" trend="-4.1%" />
         <FinancialCard title="Margem Líquida" value={totals.balance} icon={DollarSign} color="bg-accent/20 text-accent" />
      </div>

      <div className="glass-card p-10 bg-secondary/20 border-white/5 space-y-10">
         <div className="flex items-center gap-4">
            <Filter className="w-6 h-6 text-accent" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-muted">Auditoria de Dados</h3>
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 relative">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
               <input type="text" placeholder="BUSCAR TRANSAÇÃO..." className="input-field pl-16 py-5 bg-primary border-none shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-4">
               <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field py-5 bg-primary border-none" />
               <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field py-5 bg-primary border-none" />
            </div>
            <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="input-field py-5 bg-primary border-none"><option value="all">TODOS OPERADORES</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}</select>
         </div>
      </div>

      <div className="space-y-6">
         <div className="flex justify-between items-center px-2">
            <h3 className="text-[11px] font-black text-muted uppercase tracking-[0.4em] flex items-center gap-3">
               <BarChart2 className="w-5 h-5 text-accent" /> Fluxo de Caixa Recente
            </h3>
            <div className="bg-primary p-1 rounded-2xl flex gap-2 border border-white/5 shadow-2xl">
               {['all', 'income', 'expense'].map((t) => (
                 <button key={t} onClick={() => setFilterType(t as any)} className={cn("px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", filterType === t ? "bg-accent text-white" : "text-muted hover:text-text")}>
                   {t === 'all' ? 'Tudo' : t === 'income' ? 'Entradas' : 'Saídas'}
                 </button>
               ))}
            </div>
         </div>

         <div className="grid grid-cols-1 gap-4">
            {filteredTransactions.map(t => (
               <div key={t.id} className="glass-card p-6 bg-secondary/30 border-white/5 flex justify-between items-center group hover:bg-secondary/50 transition-all border-l-8" style={{ borderLeftColor: t.type === 'income' ? '#22c55e' : '#ef4444' }}>
                  <div className="flex gap-6 items-center">
                     <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border border-white/5 shadow-2xl", t.type === 'income' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
                        {t.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                     </div>
                     <div>
                        <h4 className="text-sm font-black text-text uppercase tracking-tighter mb-1">{t.category}</h4>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">{t.description || 'N/A'}</p>
                        <div className="flex items-center gap-3 mt-2">
                           <span className="text-[9px] font-black text-accent uppercase tracking-widest">{t.creatorName}</span>
                           <span className="w-1 h-1 rounded-full bg-white/10" />
                           <span className="text-[9px] font-black text-muted uppercase tracking-widest leading-none">{format(new Date(t.date || t.createdAt), 'dd MMMM', { locale: ptBR })}</span>
                        </div>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className={cn("text-2xl font-black tracking-tighter leading-none mb-3", t.type === 'income' ? "text-green-400" : "text-red-400")}>
                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                     </p>
                     <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTransaction(t); setFormData({ type: t.type, category: t.category, amount: t.amount, date: format(new Date(t.date || t.createdAt), 'yyyy-MM-dd'), description: t.description || '' }); setIsModalOpen(true); }} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-accent hover:text-white transition-all"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm(t.id)} className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
      {renderModals()}
    </div>
  );

  function renderModals() {
    return (
       isModalOpen && (
         <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[100] flex items-center justify-center p-4">
            <div className="bg-primary/95 border border-white/10 rounded-[3rem] w-full max-w-xl p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative">
               <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-10 text-muted hover:text-white"><X className="w-8 h-8" /></button>
               <h3 className="industrial-header text-3xl mb-10">Comando <span className="metallic-gold">Financeiro</span></h3>
               <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-2 bg-secondary/20 p-2 rounded-2xl border border-white/5">
                     <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={cn("py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all", formData.type === 'income' ? "bg-accent text-white shadow-2xl" : "text-muted")}>Entrada</button>
                     <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={cn("py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all", formData.type === 'expense' ? "bg-red-500 text-white shadow-2xl" : "text-muted")}>Saída</button>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-muted uppercase tracking-[0.4em] ml-2">Categoria e Valor</label>
                     <input required className="input-field py-5 bg-background border-white/5" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="EX: ALUGUEL, PRODUTOS, LUZ" />
                     <div className="grid grid-cols-2 gap-4">
                        <input required type="number" className="input-field py-5 bg-background border-white/5" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
                        <input required type="date" className="input-field py-5 bg-background border-white/5" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                     </div>
                     <textarea className="input-field py-5 bg-background border-white/5 min-h-[120px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="DESCRIÇÃO ADICIONAL..." />
                  </div>
                  <button type="submit" className="btn-accent w-full py-6 text-xs font-black uppercase tracking-[0.4em] shadow-2xl">Confirmar Lançamento</button>
               </form>
            </div>
         </div>
       )
    );
  }
}

function FinancialCard({ title, value, icon: Icon, color, trend }: any) {
  return (
    <div className="glass-card p-10 bg-secondary/30 border-white/5 flex flex-col justify-between h-64 group relative overflow-hidden">
      <div className="flex justify-between items-start">
         <div className={cn("w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-2xl border border-white/5", color)}><Icon className="w-8 h-8" /></div>
         {trend && <span className={cn("text-[9px] font-black px-4 py-2 rounded-xl bg-white/5 uppercase tracking-[0.2em] border border-white/10", trend.includes('+') ? "text-green-400" : "text-red-400")}>{trend}</span>}
      </div>
      <div className="mt-auto">
         <p className="text-[11px] font-black text-muted uppercase tracking-[0.4em] mb-2 opacity-40">{title}</p>
         <h3 className="text-4xl font-black text-text tracking-tighter leading-none group-hover:metallic-gold transition-all duration-700">{formatCurrency(value)}</h3>
      </div>
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-[100px]" />
    </div>
  );
}
