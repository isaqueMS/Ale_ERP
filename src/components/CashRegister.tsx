import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Minus, TrendingUp, TrendingDown, DollarSign, 
  Search, Filter, Trash2, Edit3, Calendar, 
  ArrowUpRight, ArrowDownRight, Wallet, X,
  Clock, Download, ChevronRight, FileText, ArrowRight
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction } from '../types';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/auth';

export default function CashRegister() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });
    return unsub;
  }, []);

  const totals = useMemo(() => {
    return transactions.reduce((acc, t) => {
      const amount = Number(t.amount) || 0;
      if (t.type === 'income') acc.income += amount;
      else acc.expense += amount;
      acc.balance = acc.income - acc.expense;
      return acc;
    }, { income: 0, expense: 0, balance: 0 });
  }, [transactions]);

  const filteredTransactions = transactions.filter(t => 
    t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      type: modalType,
      category: formData.category,
      amount: Number(formData.amount),
      description: formData.description,
      date: formData.date,
      creatorId: user?.uid,
      creatorName: user?.name,
      createdAt: new Date().toISOString()
    };

    if (editingTransaction) await updateDoc(doc(db, 'transactions', editingTransaction.id), data);
    else await addDoc(collection(db, 'transactions'), data);
    
    setIsModalOpen(false);
    setEditingTransaction(null);
    setFormData({ category: '', amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
  };

  return (
    <div className="space-y-10 animate-fade-up pb-20">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
           <h2 className="text-3xl sm:text-4xl font-black text-slate-800 uppercase tracking-tighter">Fluxo de Caixa</h2>
           <p className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">Controle financeiro em tempo real.</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
           <button onClick={() => { setModalType('income'); setIsModalOpen(true); }} className="flex-1 sm:flex-none h-14 sm:h-16 px-6 sm:px-8 rounded-2xl bg-emerald-500 text-white font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95">
              <Plus className="w-5 h-5" /> Receita
           </button>
           <button onClick={() => { setModalType('expense'); setIsModalOpen(true); }} className="flex-1 sm:flex-none h-14 sm:h-16 px-6 sm:px-8 rounded-2xl bg-red-400 text-white font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-lg shadow-red-100 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95">
              <Minus className="w-5 h-5" /> Despesa
           </button>
        </div>
      </header>

      {/* BALANCE OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <BalanceCard title="Saldo Atual" value={totals.balance} icon={Wallet} color="pink" isMain />
         <BalanceCard title="Total Entradas" value={totals.income} icon={ArrowUpRight} color="green" />
         <BalanceCard title="Total Saídas" value={totals.expense} icon={ArrowDownRight} color="red" />
      </div>

      {/* TRANSACTION LIST */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="relative w-full md:w-96 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFB6C1] transition-transform group-focus-within:scale-110" />
              <input 
                type="text" 
                placeholder="Filtrar lançamentos..." 
                className="input-premium pl-14 pr-6 !py-4 shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-8 py-5 rounded-2xl border border-slate-100 shadow-sm hover:bg-[#FFB6C1] hover:text-white transition-all active:scale-95 group">
              <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /> Exportar Relatório PDF
           </button>
        </div>

        <div className="card-premium overflow-hidden border border-pink-50/50 text-slate-800">
           <div className="divide-y divide-slate-50">
              {filteredTransactions.map(t => (
                <div key={t.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:bg-[#FFFDFB] group relative">
                   <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 group-hover:rotate-3",
                        t.type === 'income' ? "bg-emerald-50 text-emerald-500 border border-emerald-100" : "bg-red-50 text-red-500 border border-red-100"
                      )}>
                         {t.type === 'income' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{format(parseISO(t.date), "dd MMM, yyyy", { locale: ptBR })}</span>
                            {isToday(parseISO(t.date)) && <span className="text-[8px] font-black text-emerald-500 uppercase bg-emerald-50 px-2.5 py-1 rounded-full animate-pulse">Hoje</span>}
                         </div>
                         <h4 className="text-lg font-black text-white mix-blend-difference uppercase leading-none mb-1 tracking-tight">{t.category}</h4>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px] italic">{t.description || 'Nenhuma descrição informada'}</p>
                      </div>
                   </div>

                   <div className="flex items-center gap-8 justify-between md:justify-end">
                      <div className="text-right">
                         <p className={cn(
                           "text-2xl font-black font-mono tracking-tighter leading-none italic",
                           t.type === 'income' ? "text-emerald-500" : "text-red-500"
                         )}>
                           {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                         </p>
                         <div className="flex items-center justify-end gap-1.5 mt-1.5 opacity-60">
                            <Clock className="w-3 h-3 text-slate-300" />
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Registrado por {t.creatorName || 'Sistema'}</p>
                         </div>
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                         <button onClick={() => { setEditingTransaction(t); setFormData({ category: t.category, amount: t.amount.toString(), description: t.description || '', date: t.date }); setModalType(t.type); setIsModalOpen(true); }} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-[#FFB6C1] rounded-xl shadow-sm transition-all active:scale-90"><Edit3 className="w-4 h-4" /></button>
                         <button onClick={() => deleteDoc(doc(db, 'transactions', t.id))} className="p-3 bg-white border border-slate-100 text-slate-300 hover:text-red-400 rounded-xl shadow-sm transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>
                      </div>
                   </div>
                </div>
              ))}
              {filteredTransactions.length === 0 && (
                <div className="p-20 text-center">
                   <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                      <FileText className="w-8 h-8 text-slate-200" />
                   </div>
                   <h3 className="text-xl font-black text-slate-300 uppercase tracking-tighter italic">Nenhum lançamento encontrado</h3>
                   <p className="text-xs font-bold text-slate-200 uppercase tracking-widest mt-2">{searchTerm ? 'Tente buscar por outra categoria' : 'Comece registrando uma nova operação'}</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-center mb-6 shrink-0 pr-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{editingTransaction ? 'Editar' : 'Nova'} {modalType === 'income' ? 'Receita' : 'Despesa'}</h3>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Operação de fluxo de caixa studio.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Categoria / Título</label>
                  <input required className="input-premium !py-3 !px-5 shadow-sm" placeholder="Ex: Venda de Produtos, Aluguel..." value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Valor (R$)</label>
                    <input required type="number" step="0.01" className="input-premium !py-3 !px-5 font-mono shadow-sm" placeholder="0,00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Data da Operação</label>
                    <input required type="date" className="input-premium !py-3 !px-5 shadow-sm font-black text-[10px] uppercase" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>
                <div className="relative pt-1.5 font-sans mb-4">
                   <label className="label-premium !text-[9px] !mb-1.5">Descrição Detalhada</label>
                   <textarea className="textarea-premium h-24 shadow-inner" placeholder="Pequena descrição para facilitar o controle futuro..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <button type="submit" className={cn(
                  "w-full h-14 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group",
                  modalType === 'income' ? "bg-emerald-500 text-white shadow-emerald-100" : "bg-red-500 text-white shadow-red-100"
                )}>
                   Finalizar Lançamento <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceCard({ title, value, icon: Icon, color, isMain }: any) {
  return (
    <div className={cn(
      "p-8 rounded-[2.5rem] relative overflow-hidden transition-all group hover:scale-[1.02]",
      isMain ? "bg-[#FFB6C1] text-white shadow-2xl shadow-pink-100" : "bg-white text-slate-800 shadow-sm border border-pink-50"
    )}>
       <div className={cn(
         "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
         isMain ? "bg-white/20 text-white" : "bg-pink-50 text-[#FFB6C1]"
       )}>
          <Icon className="w-6 h-6" />
       </div>
       <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-2", isMain ? "text-white/80" : "text-slate-400")}>{title}</p>
       <p className="text-3xl font-black font-mono tracking-tighter leading-none">{formatCurrency(value)}</p>
    </div>
  );
}
