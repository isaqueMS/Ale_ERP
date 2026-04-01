import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Phone, Mail, Award, CheckCircle, XCircle, Shield, User, Users, Info, Settings } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../lib/firebase';
import { Staff } from '../types';
import { cn, formatPhone } from '../lib/utils';
import { useAuth } from '../lib/auth';

export default function StaffManagement() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<Staff | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const SPECIALTIES = ['Cabelo', 'Unhas', 'Barba', 'Estética'];

  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    email: '',
    specialties: [] as string[],
    commission: 0,
    status: 'active' as const,
    photoUrl: '',
    password: '',
    role: 'agente' as 'admin' | 'agente' | 'staff'
  });

  const [errorStatus, setErrorStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'staff'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      staffData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStaff(staffData);
      setErrorStatus(null);
    }, (err) => {
      console.error('Error fetching staff:', err);
      setErrorStatus(`Erro no Firebase: ${err.code}`);
    });
    return () => unsubscribe();
  }, []);

  const toggleSpecialty = (s: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter(item => item !== s)
        : [...prev.specialties, s]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("Acesso restrito para administradores.");
      return;
    }
    if (formData.specialties.length === 0) {
      alert("Selecione pelo menos uma especialidade.");
      return;
    }
    setLoading(true);

    let secondaryApp;
    try {
      if (editingStaff) {
        await updateDoc(doc(db, 'staff', editingStaff.id), {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          specialties: formData.specialties,
          commission: formData.commission,
          status: formData.status,
          photoUrl: formData.photoUrl
        });

        // Atualizar role no perfil do usuário
        const staffUid = (editingStaff as any).uid;
        if (staffUid) {
          await setDoc(doc(db, 'users', staffUid), {
            role: formData.role,
            name: formData.name,
            email: formData.email || `${formData.phone.replace(/\D/g, '')}@estudioale.com`
          }, { merge: true });
        }
      } else {
        const secondaryAppName = `SecondaryAuth-${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        const staffEmail = formData.email || `${formData.phone.replace(/\D/g, '')}@estudioale.com`;
        
        let uid: string;
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, staffEmail, formData.password || '123456');
          uid = userCredential.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') throw new Error('E-mail em uso.');
          throw authError;
        }
        
        await addDoc(collection(db, 'staff'), {
          ...formData,
          email: staffEmail,
          uid,
          createdAt: new Date().toISOString()
        });

        // Criar perfil do usuário com role
        await setDoc(doc(db, 'users', uid), {
          role: formData.role,
          name: formData.name,
          email: staffEmail
        });
      }

      setIsModalOpen(false);
      setEditingStaff(null);
      setFormData({ name: '', phone: '', email: '', specialties: [], commission: 0, status: 'active', photoUrl: '', password: '', role: 'agente' });
      setShowSuccess(true);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      if (secondaryApp) deleteApp(secondaryApp).catch(console.error);
      setLoading(false);
    }
  };

  const handleEdit = (member: Staff) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      phone: member.phone,
      email: member.email || '',
      specialties: member.specialties || (member as any).specialty ? [(member as any).specialty] : [],
      commission: member.commission,
      status: member.status,
      photoUrl: member.photoUrl || '',
      password: '',
      role: (member as any).role || 'agente'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este atendente?')) {
      await deleteDoc(doc(db, 'staff', id));
    }
  };

  const filteredStaff = staff.filter(member => 
    (member.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.specialties || []).some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isMobile) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4 animate-in fade-in duration-500 bg-[#FDFDFD] min-h-screen">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-text tracking-tighter uppercase">Minha Equipe</h2>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-none">Gestão de profissionais</p>
        </header>

        <div className="mobile-card p-3 flex items-center gap-3 bg-white border border-secondary shadow-premium">
          <Search className="text-primary w-4 h-4 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar por profissional..." 
            className="bg-transparent flex-1 border-none focus:ring-0 text-xs font-bold text-text placeholder:text-muted p-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredStaff.map((member) => (
            <div key={member.id} className="mobile-card overflow-hidden bg-white border border-secondary/20 relative group">
               <div className="h-16 bg-primary/5 border-b border-secondary/10 flex items-center justify-end px-4 gap-2">
                 {isAdmin && (
                   <>
                     <button onClick={() => handleEdit(member)} className="w-8 h-8 bg-white text-blue-600 rounded-lg flex items-center justify-center shadow-premium border border-blue-50 active:scale-95"><Edit2 className="w-4 h-4" /></button>
                     <button onClick={() => handleDelete(member.id)} className="w-8 h-8 bg-white text-red-600 rounded-lg flex items-center justify-center shadow-premium border border-red-50 active:scale-95"><Trash2 className="w-4 h-4" /></button>
                   </>
                 )}
               </div>
               <div className="px-5 pb-5 pt-10 relative">
                 <div className="absolute -top-10 left-5">
                    <div className="w-20 h-20 rounded-[2rem] border-4 border-white bg-secondary/20 flex items-center justify-center overflow-hidden shadow-xl">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-black text-primary">{member.name?.[0] || '?'}</span>
                      )}
                    </div>
                 </div>
                 <div className="flex justify-between items-end">
                    <div>
                       <h4 className="font-black text-lg text-text uppercase tracking-tighter leading-tight">{member.name}</h4>
                       <div className="flex flex-wrap gap-1 mt-1">
                         {(member.specialties || []).map(s => (
                           <div key={s} className="flex items-center gap-1 text-[8px] font-black text-muted uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded-full">
                             <Award className="w-2 h-2 text-accent" />
                             <span>{s}</span>
                           </div>
                         ))}
                       </div>
                    </div>
                    <div className="text-right">
                       <span className={cn(
                         "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                         member.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                       )}>
                         {member.status === 'active' ? 'Ativo' : 'Inativo'}
                       </span>
                       <p className="text-xs font-black text-accent mt-1">{member.commission}% Comiss.</p>
                    </div>
                 </div>
                 <div className="mt-4 pt-4 border-t border-secondary/10 space-y-1">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted lowercase">
                     <Phone className="w-3 h-3 text-primary" />
                     <span>{formatPhone(member.phone)}</span>
                   </div>
                 </div>
               </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <button 
            onClick={() => { setEditingStaff(null); setIsModalOpen(true); }}
            className="fab-button"
          >
            <Plus className="w-8 h-8" />
          </button>
        )}

        {renderModal()}
        {renderSuccess()}
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-text tracking-tighter uppercase">Minha Equipe</h2>
          <p className="text-muted mt-1 font-bold">Gerencie os atendentes e suas especialidades.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingStaff(null); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 py-3 px-8 shadow-premium">
            <Plus className="w-5 h-5" /> Novo Atendente
          </button>
        )}
      </header>

      <div className="glass-card p-4 flex items-center gap-4 bg-white/70 shadow-premium border border-secondary/30">
        <Search className="text-primary w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar por profissional..." 
          className="bg-transparent flex-1 border-none focus:ring-0 text-text font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredStaff.map((member) => (
          <div key={member.id} className="glass-card overflow-hidden group transition-all hover:shadow-2xl hover:-translate-y-2 border border-secondary/30 bg-white shadow-premium">
            <div className="h-24 bg-primary/5 border-b border-secondary/10 relative">
              <div className="absolute -bottom-10 left-8">
                <div className="w-24 h-24 rounded-[2rem] border-4 border-white bg-secondary/10 flex items-center justify-center overflow-hidden shadow-xl">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-black text-primary">{member.name?.[0] || '?'}</span>
                  )}
                </div>
              </div>
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(member)} className="p-2.5 bg-white/90 backdrop-blur-sm rounded-xl text-text hover:text-blue-600 shadow-md transition-all active:scale-90 border border-secondary/20"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(member.id)} className="p-2.5 bg-white/90 backdrop-blur-sm rounded-xl text-text hover:text-red-600 shadow-md transition-all active:scale-90 border border-secondary/20"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="pt-14 p-8 space-y-6">
              <div>
                <h4 className="text-2xl font-black text-text uppercase tracking-tighter leading-tight">{member.name}</h4>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(member.specialties || []).map(s => (
                    <div key={s} className="flex items-center gap-2 text-primary text-[9px] font-black uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full w-fit">
                      <Award className="w-3 h-3 text-accent" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm font-bold text-muted"> <Phone className="w-4 h-4 text-accent" /> <span>{formatPhone(member.phone)}</span> </div>
                {member.email && ( <div className="flex items-center gap-3 text-sm font-bold text-muted"> <Mail className="w-4 h-4 text-primary" /> <span className="lowercase">{member.email}</span> </div> )}
              </div>

              <div className="pt-6 border-t border-secondary/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={cn( "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full", member.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700" )}> {member.status === 'active' ? 'Ativo' : 'Inativo'} </span>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-muted uppercase font-black tracking-widest mb-1">Comissão</p>
                  <p className="text-2xl font-black text-accent">{member.commission}%</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {renderModal()}
      {renderSuccess()}
    </div>
  );

  function renderModal() {
    return (
      <>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-y-auto max-h-[90vh]">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-2 hover:bg-secondary/20 rounded-full transition-colors"><XCircle className="w-6 h-6 text-muted" /></button>
              <h3 className="text-3xl font-black tracking-tighter mb-8 uppercase flex items-center gap-3"><Users className="w-10 h-10 text-primary" /> {editingStaff ? 'Editar' : 'Novo'} Profissional</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2"> <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Nome Completo</label> <input required className="input-field py-3 font-bold" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /> </div>
                  <div> <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Telefone</label> <input required className="input-field py-3 font-bold" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /> </div>
                  <div> <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">E-mail</label> <input className="input-field py-3 font-bold" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /> </div>
                  
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-2 ml-1">Especialidades</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SPECIALTIES.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSpecialty(s)}
                          className={cn(
                            "py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center border",
                            formData.specialties.includes(s)
                              ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                              : "bg-white text-muted border-secondary hover:border-primary/30"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div> <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Comissão (%)</label> <input required type="number" className="input-field py-3 font-bold" value={formData.commission} onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) })} /> </div>
                  {!editingStaff && ( <div className="col-span-2"> <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Senha de Acesso Profissional</label> <input required type="password" placeholder="Mínimo 6 dígitos" className="input-field py-3 font-bold" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} /> </div> )}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Nível de Acesso</label>
                    <div className="flex bg-secondary/10 p-1 rounded-2xl">
                      <button type="button" onClick={() => setFormData({...formData, role: 'agente'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.role === 'agente' ? "bg-white text-blue-600 shadow-sm" : "text-muted")}>Agente</button>
                      <button type="button" onClick={() => setFormData({...formData, role: 'admin'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.role === 'admin' ? "bg-white text-green-600 shadow-sm" : "text-muted")}>Admin</button>
                    </div>
                    <p className="text-[9px] text-muted mt-1 italic">Agente: gerencia sua própria agenda e portfólio. Admin: controle total.</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-muted tracking-widest mb-1 ml-1">Status na Plataforma</label>
                    <div className="flex bg-secondary/10 p-1 rounded-2xl">
                      <button type="button" onClick={() => setFormData({...formData, status: 'active'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.status === 'active' ? "bg-white text-green-600 shadow-sm" : "text-muted")}>Ativo</button>
                      <button type="button" onClick={() => setFormData({...formData, status: 'inactive'})} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all", formData.status === 'inactive' ? "bg-white text-red-600 shadow-sm" : "text-muted")}>Inativo</button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-10">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs font-black uppercase tracking-widest px-10">Sair</button>
                  <button type="submit" disabled={loading} className="btn-primary text-xs font-black uppercase tracking-widest px-10 shadow-xl">{loading ? 'Salvando...' : 'Salvar Perfil'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  function renderSuccess() {
     return showSuccess && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-24 h-24 bg-green-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner shadow-green-200/50"> <CheckCircle className="w-12 h-12 text-green-600" /> </div>
            <h3 className="text-3xl font-black tracking-tighter mb-3 uppercase">Sucesso!</h3>
            <p className="text-muted font-bold mb-10 leading-relaxed uppercase text-[10px] tracking-widest">O profissional agora faz parte oficialmente da equipe Studio Ale.</p>
            <button onClick={() => { setShowSuccess(false); navigate('/'); }} className="w-full btn-primary py-5 text-xs font-black uppercase tracking-widest rounded-3xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">Ir para o Início</button>
          </div>
        </div>
      );
  }
}
