import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Edit3, Trash2, UserPlus,
  Phone, Mail, Calendar, X, MoreVertical,
  CheckCircle2, AlertCircle, TrendingUp, Scissors,
  Lock, Shield, Eye, EyeOff, ArrowRight, Send, KeyRound
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Staff, Appointment } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { format, parseISO, startOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createStaffLogin, sendStaffPasswordReset } from '../lib/staffAuth';

import { STAFF_SPECIALTIES, SERVICE_CATEGORIES } from '../constants';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  newPassword: '',
  specialty: STAFF_SPECIALTIES[0],
  commission: 50,
  role: 'staff' as 'admin' | 'agente' | 'staff',
  status: 'active' as 'active' | 'inactive',
  enabledCategories: [] as string[]
};

export default function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [viewingStaffDetails, setViewingStaffDetails] = useState<Staff | null>(null);
  const [staffAppointments, setStaffAppointments] = useState<Appointment[]>([]);
  const [historyStart, setHistoryStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [historyEnd, setHistoryEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Um profissional criado ANTES desta correção pode não ter uma conta de
  // login de verdade no Firebase Auth ainda (ver StaffManagement / staffAuth.ts).
  // Nesse caso, tratamos como se fosse uma criação nova: precisa de senha.
  const needsNewLogin = !editingStaff || !editingStaff.uid;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (viewingStaffDetails) {
       const q = query(collection(db, 'appointments'), where('staffId', '==', viewingStaffDetails.id));
       const unsub = onSnapshot(q, (snapshot) => {
          setStaffAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
       });
       return unsub;
    }
  }, [viewingStaffDetails]);

  const filteredAppointments = useMemo(() => {
    return staffAppointments.filter(a => {
      try {
        return isWithinInterval(parseISO(a.date), {
          start: new Date(historyStart + 'T00:00:00'),
          end: new Date(historyEnd + 'T23:59:59')
        });
      } catch (e) { return false; }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [staffAppointments, historyStart, historyEnd]);

  const stats = useMemo(() => {
    if (!viewingStaffDetails) return null;
    const completed = filteredAppointments.filter(a => a.status === 'completed');
    const totalRevenue = completed.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    const totalCommission = completed.reduce((sum, a) => sum + (Number(a.commissionAmount) || 0), 0);
    return { count: completed.length, totalRevenue, totalCommission };
  }, [filteredAppointments, viewingStaffDetails]);

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.specialty || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormError('');
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (needsNewLogin && formData.newPassword.length < 6) {
      setFormError('Defina uma senha de acesso com pelo menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      // uid do Firebase Auth do profissional. Só é criado (via instância
      // secundária, sem derrubar a sessão do admin) quando ainda não existe.
      let uid = editingStaff?.uid;
      if (needsNewLogin) {
        uid = await createStaffLogin(formData.email, formData.newPassword);
      }

      const staffData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        specialty: formData.specialty,
        commission: formData.commission,
        role: formData.role,
        status: formData.status,
        enabledCategories: formData.enabledCategories,
        uid: uid || null,
        createdAt: editingStaff?.createdAt || new Date().toISOString()
      };

      if (editingStaff) await updateDoc(doc(db, 'staff', editingStaff.id), staffData);
      else await addDoc(collection(db, 'staff'), staffData);

      // Mantém o "Nível de Acesso" escolhido aqui sincronizado com o
      // documento que o app realmente usa para calcular permissões
      // (users/{uid}.role, lido em src/lib/auth.tsx). Antes desta correção
      // trocar o nível de acesso aqui não tinha nenhum efeito no login real.
      if (uid) {
        await setDoc(doc(db, 'users', uid), {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }

      closeModal();
    } catch (error: any) {
      console.error('Erro ao salvar profissional:', error);
      setFormError(
        error?.code === 'auth/email-already-in-use'
          ? 'Este e-mail já está em uso por outra conta de login.'
          : 'Erro ao salvar profissional. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!editingStaff?.email) return;
    setResettingPassword(true);
    try {
      await sendStaffPasswordReset(editingStaff.email);
      alert(`E-mail de redefinição de senha enviado para ${editingStaff.email}.`);
    } catch (error) {
      console.error('Erro ao enviar redefinição de senha:', error);
      alert('Não foi possível enviar o e-mail de redefinição de senha.');
    } finally {
      setResettingPassword(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      enabledCategories: prev.enabledCategories.includes(cat)
        ? prev.enabledCategories.filter(c => c !== cat)
        : [...prev.enabledCategories, cat]
    }));
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
           <h2 className="text-2xl sm:text-3xl font-display font-semibold text-slate-800 tracking-tight">Equipe do Studio</h2>
           <p className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">Gerencie acessos, comissões e perfis.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full sm:w-auto">
          <Plus className="w-5 h-5" /> Novo Profissional
        </button>
      </header>

      {/* SEARCH BAR */}
      <div className="relative group">
         <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center transition-transform group-focus-within:scale-110">
            <Search className="w-5 h-5 text-[#E38EA0]" />
         </div>
         <input
            type="text"
            placeholder="Buscar por nome ou especialidade..."
            className="input-premium pl-16 pr-6 !py-4 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
         />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {filteredStaff.map(member => (
          <div key={member.id} className="card-premium p-8 relative flex flex-col justify-between group">
             <div>
                <div className="flex justify-between items-start mb-6">
                   <div className="relative cursor-pointer" onClick={() => setViewingStaffDetails(member)}>
                      <div className="w-20 h-20 bg-pink-50 rounded-4xl flex items-center justify-center border-2 border-white shadow-lg overflow-hidden transition-transform duration-500 group-hover:scale-105">
                         {member.photoUrl ? (
                           <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                         ) : (
                           <span className="text-3xl font-semibold text-[#E38EA0] uppercase">{member.name[0]}</span>
                         )}
                      </div>
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                        member.status === 'active' ? "bg-green-500" : "bg-slate-300"
                      )}>
                         <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                     <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        <span className="text-[9px] font-semibold uppercase text-slate-400 tracking-widest">{member.role}</span>
                     </div>
                     {!member.uid && (
                       <div className="bg-amber-50 px-3 py-1 rounded-full border border-amber-100" title="Este profissional ainda não tem login criado no Firebase Auth">
                          <span className="text-[8px] font-semibold uppercase text-amber-500 tracking-widest">Sem login</span>
                       </div>
                     )}
                   </div>
                </div>

                <h3 className="text-xl font-semibold text-slate-800 uppercase leading-none mb-2 tracking-tight">{member.name}</h3>
                <p className="text-[10px] font-semibold text-[#E38EA0] uppercase tracking-widest mb-6 flex items-center gap-2">
                   <Scissors className="w-3 h-3" /> {member.specialty}
                </p>

                <div className="space-y-3">
                   <div className="flex items-center gap-3 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-pink-200" />
                      <span className="text-xs font-bold truncate max-w-[180px]">{member.email}</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-500">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-tight">Comissão: {member.commission}%</span>
                   </div>
                   <div className="flex flex-wrap gap-1 mt-4">
                      {member.enabledCategories?.map(cat => (
                        <span key={cat} className="text-[8px] font-semibold uppercase bg-pink-50 text-[#E38EA0] px-2 py-1 rounded-md border border-pink-100">{cat}</span>
                      ))}
                   </div>
                </div>
             </div>

             <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <button
                  onClick={() => setViewingStaffDetails(member)}
                  className="text-[10px] font-semibold uppercase tracking-widest px-4 py-2.5 bg-pink-50 text-[#E38EA0] rounded-xl hover:bg-[#E38EA0] hover:text-white transition-all flex items-center gap-2 shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver Produção
                </button>

                <div className="flex gap-2">
                   <button onClick={() => { setEditingStaff(member); setFormData({ name: member.name, phone: member.phone, email: member.email, newPassword: '', specialty: member.specialty, commission: member.commission, role: member.role, status: member.status, enabledCategories: member.enabledCategories || [] }); setFormError(''); setIsModalOpen(true); }} className="p-2.5 bg-white text-slate-400 hover:text-[#E38EA0] rounded-xl border border-slate-100 shadow-sm transition-all active:scale-90"><Edit3 className="w-4 h-4" /></button>
                   <button onClick={() => deleteDoc(doc(db, 'staff', member.id))} className="p-2.5 bg-white text-slate-400 hover:text-red-400 rounded-xl border border-slate-100 shadow-sm transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>
                </div>
             </div>
          </div>
        ))}
      </div>

      {viewingStaffDetails && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setViewingStaffDetails(null)} />
           <div className="flex min-h-full items-start md:items-center justify-center">
              <div className="bg-[#FAFAFA] rounded-5xl w-full max-w-4xl p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
                 <div className="flex justify-between items-center mb-8 shrink-0 pr-12">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-pink-50 shadow-sm overflow-hidden shrink-0">
                          {viewingStaffDetails.photoUrl ? (
                            <img src={viewingStaffDetails.photoUrl} className="w-full h-full object-cover" alt={viewingStaffDetails.name} />
                          ) : (
                            <span className="text-2xl font-semibold text-[#E38EA0]">{viewingStaffDetails.name[0]}</span>
                          )}
                       </div>
                       <div>
                          <h3 className="text-xl md:text-2xl font-semibold text-slate-800 uppercase tracking-tighter leading-none">{viewingStaffDetails.name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{viewingStaffDetails.specialty} • {viewingStaffDetails.commission}% Comissão Studio</p>
                       </div>
                    </div>
                    <button onClick={() => setViewingStaffDetails(null)} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
                 </div>

                 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0 pb-6 border-b border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                       <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:border-pink-100">
                          <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest mb-1">Total Serviços</p>
                          <p className="text-2xl font-semibold text-slate-800">{stats?.count || 0}</p>
                       </div>
                       <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:border-pink-100">
                          <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest mb-1">Faturamento Bruto</p>
                          <p className="text-2xl font-semibold text-emerald-500">{formatCurrency(stats?.totalRevenue || 0)}</p>
                       </div>
                       <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:border-pink-100">
                          <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest mb-1">Comissão Líquida</p>
                          <p className="text-2xl font-semibold text-amber-500">{formatCurrency(stats?.totalCommission || 0)}</p>
                       </div>
                    </div>

                    <div className="flex flex-col gap-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shrink-0 min-w-[280px]">
                       <label className="label-premium !mb-0 !leading-none pb-2">Período de Análise</label>
                       <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-[#E38EA0]" />
                          <div className="flex items-center gap-2">
                             <input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)} className="input-premium !py-1.5 !px-3 !rounded-lg text-[10px] uppercase font-semibold" />
                             <span className="text-[10px] font-bold text-slate-300">➜</span>
                             <input type="date" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)} className="input-premium !py-1.5 !px-3 !rounded-lg text-[10px] uppercase font-semibold" />
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="w-full overflow-x-auto pb-6">
                    <table className="w-full min-w-[600px]">
                       <thead>
                          <tr className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest border-b border-slate-100">
                             <th className="py-4 text-left px-2">Data Atendimento</th>
                             <th className="py-4 text-left px-2">Serviço Realizado</th>
                             <th className="py-4 text-right px-2">Valor Base</th>
                             <th className="py-4 text-right px-2">Comissão Agente</th>
                             <th className="py-4 text-center px-2">Situação</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {filteredAppointments.map(a => (
                             <tr key={a.id} className="group transition-colors hover:bg-[#FBF7F6]">
                                <td className="py-5 px-2">
                                   <p className="text-[11px] font-semibold text-slate-800">{format(parseISO(a.date), 'dd MMM, yyyy', { locale: ptBR })}</p>
                                </td>
                                <td className="py-5 px-2">
                                   <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-tight">{a.service}</p>
                                   <p className="text-[9px] font-bold text-slate-300 uppercase italic">Ticket #{a.id.slice(-6).toUpperCase()}</p>
                                </td>
                                <td className="py-5 px-2 text-right">
                                   <p className="text-xs font-semibold text-slate-800 font-mono italic">{formatCurrency(a.price)}</p>
                                </td>
                                <td className="py-5 px-2 text-right">
                                   <p className="text-xs font-semibold text-amber-500 font-mono">{formatCurrency(a.commissionAmount)}</p>
                                </td>
                                <td className="py-5 px-2 text-center">
                                   <span className={cn(
                                      "text-[8px] font-semibold uppercase px-3 py-1 rounded-full border shadow-sm",
                                      a.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                      a.status === 'scheduled' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-400 border-red-100"
                                   )}>
                                      {a.status === 'completed' ? 'Concluído' : a.status === 'scheduled' ? 'Agendado' : 'Cancelado'}
                                   </span>
                                </td>
                             </tr>
                          ))}
                          {filteredAppointments.length === 0 && (
                             <tr>
                                <td colSpan={5} className="py-24 text-center">
                                   <div className="flex flex-col items-center gap-3 grayscale opacity-30">
                                      <Scissors className="w-12 h-12" />
                                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada no período.</p>
                                   </div>
                                </td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-4 pb-8 md:pt-12 md:pb-16 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={closeModal} />
          <div className="flex min-h-full items-start md:items-center justify-center">
            <div className="bg-white rounded-5xl w-full max-w-xl p-8 md:p-12 shadow-2xl animate-fade-up border border-pink-50 relative flex flex-col z-10 transition-all sm:my-auto">
              <div className="flex justify-between items-center mb-6 shrink-0 pr-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold text-slate-800 uppercase tracking-tight leading-none">{editingStaff ? 'Editar' : 'Novo'} Acesso</h3>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2 px-1 opacity-70">Perfil e credenciais de login do studio.</p>
                </div>
                <button onClick={closeModal} className="absolute top-0 right-0 p-8 text-slate-300 hover:text-slate-600 transition-all active:scale-90"><X className="w-8 h-8" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative pt-1.5 font-sans">
                  <label className="floating-label">Nome Completo</label>
                  <input required className="input-premium !py-2.5 !px-5" placeholder="Digite o nome..." value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Email de Acesso</label>
                    <input required type="email" className="input-premium !py-2.5 !px-5" placeholder="studio@exemplo.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                  </div>
                  {needsNewLogin ? (
                    <div className="relative pt-1.5 group font-sans">
                      <label className="floating-label">Senha de Acesso</label>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 mt-1 text-slate-300 hover:text-[#E38EA0] transition-colors z-20">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <input required minLength={6} type={showPassword ? "text" : "password"} className="input-premium !py-2.5 !px-5 !pr-10" placeholder="Mín. 6 caracteres" value={formData.newPassword} onChange={(e) => setFormData({...formData, newPassword: e.target.value})} />
                      <p className="text-[9px] font-bold text-slate-300 mt-1.5 px-1">Usada só para criar o login agora. Não fica salva em nenhum lugar.</p>
                    </div>
                  ) : (
                    <div className="relative pt-1.5 font-sans">
                      <label className="floating-label">Senha de Acesso</label>
                      <button
                        type="button"
                        disabled={resettingPassword}
                        onClick={handlePasswordReset}
                        className="w-full input-premium !py-2.5 !px-5 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-[#E38EA0] transition-colors disabled:opacity-50"
                      >
                        {resettingPassword ? 'Enviando...' : (<><Send className="w-3.5 h-3.5" /> Enviar Link de Redefinição</>)}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Especialização</label>
                    <select className="select-premium !py-2.5 !px-5" value={formData.specialty} onChange={(e) => setFormData({...formData, specialty: e.target.value})}>
                      {STAFF_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">WhatsApp/Fone</label>
                    <input required className="input-premium !py-2.5 !px-5" placeholder="(00) 00000-0000" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-4 bg-[#FBF7F6] p-6 rounded-2xl border border-slate-100 shadow-sm">
                   <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Habilitar Serviços</label>
                      <span className="text-[9px] font-bold text-[#E38EA0] uppercase tracking-tighter bg-pink-50 px-2 py-0.5 rounded-full">{formData.enabledCategories.length} selecionados</span>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {SERVICE_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all border shadow-sm",
                            formData.enabledCategories.includes(cat)
                              ? "bg-[#E38EA0] text-white border-[#E38EA0] shadow-pink-100/50 scale-[1.02]"
                              : "bg-white text-slate-400 border-slate-100 hover:border-pink-200"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-2">
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Comissão %</label>
                    <input required type="number" className="input-premium !py-2.5 !px-5 font-mono shadow-inner" value={formData.commission} onChange={(e) => setFormData({...formData, commission: Number(e.target.value)})} />
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Nível Acesso</label>
                    <select className="select-premium !py-2.5 !px-5" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as any})}>
                       <option value="staff">Profissional (Staff)</option>
                       <option value="agente">Atendente (Agente)</option>
                       <option value="admin">Gestor (Admin)</option>
                    </select>
                  </div>
                  <div className="relative pt-1.5 font-sans">
                    <label className="floating-label">Status</label>
                    <select className="select-premium !py-2.5 !px-5" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})}>
                       <option value="active">✓ Ativado</option>
                       <option value="inactive">✕ Desativado</option>
                    </select>
                  </div>
                </div>

                {formError && (
                  <div className="bg-red-50 text-red-500 text-[10px] font-semibold p-4 rounded-2xl border border-red-100 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                    <p className="leading-tight">{formError}</p>
                  </div>
                )}

                <button type="submit" disabled={submitting} className="w-full btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-widest font-semibold group shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-2 disabled:opacity-60">
                   {submitting ? 'Salvando...' : 'Salvar Perfil Profissional'} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
