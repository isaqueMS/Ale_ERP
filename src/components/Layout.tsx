import React from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../lib/auth';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { Menu, Scissors, LayoutDashboard, Calendar, Users, ShoppingBag, UserCircle, Settings, Banknote, ChevronDown, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

// Título da barra superior (desktop) por rota — mesma nomenclatura usada na
// Sidebar, só que sem precisar duplicar o array de grupos ali.
const PAGE_TITLES: Record<string, string> = {
  '/': 'Início',
  '/agenda': 'Agenda',
  '/clientes': 'Clientes',
  '/conversas': 'Caixa de Entrada',
  '/produtos': 'Produtos',
  '/vendas': 'Vender Produtos',
  '/caixa': 'Fluxo de Caixa',
  '/financeiro': 'Financeiro Geral',
  '/equipe': 'Equipe',
  '/servicos': 'Serviços do Studio',
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, isAdmin, isAgente } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem('ale-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isAccountMenuOpen, setIsAccountMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ale-sidebar-collapsed', String(next));
      } catch {
        // Preferência de UI apenas — se o navegador bloquear localStorage,
        // a sidebar continua funcionando, só não lembra o estado depois.
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Início', path: '/' },
    { icon: Calendar, label: isAdmin ? 'Agenda' : 'Serviços', path: '/agenda' },
    { icon: UserCircle, label: 'Clientes', path: '/clientes' },
  ];

  if (isAdmin) {
    navItems.push({ icon: ShoppingBag, label: 'Vendas', path: '/vendas' });
    navItems.push({ icon: Banknote, label: 'Caixa', path: '/caixa' });
    navItems.push({ icon: Users, label: 'Equipe', path: '/equipe' });
  }

  const pageTitle = PAGE_TITLES[location.pathname] || 'Início';
  const displayName = profile?.name || user?.displayName || user?.email || 'Studio Alê';
  const initial = displayName?.[0]?.toUpperCase() || 'A';
  const roleLabel = isAdmin ? 'Admin' : isAgente ? 'Agente' : 'Equipe';

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-secondary/10 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop or Mobile Drawer) */}
      <Sidebar 
        onClose={() => setIsSidebarOpen(false)}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        className={cn(
          "transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "fixed inset-y-0 left-0 translate-x-0 w-[280px]" : "hidden lg:flex"
        )}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header (Hidden in Desktop) */}
        {!isSidebarOpen && (
          <header className="lg:hidden bg-white/70 backdrop-blur-md border-b border-secondary/20 p-4 flex items-center justify-between z-30 sticky top-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-2xl shadow-inner shadow-primary/10">
                <Scissors className="text-primary w-5 h-5" />
              </div>
              <h1 className="text-lg font-semibold text-text tracking-tighter uppercase">
                Studio <span className="text-primary italic">Alê</span>
              </h1>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 bg-secondary/10 rounded-2xl transition-all active:scale-95 border border-secondary/5 shadow-sm"
              aria-label="Abrir Menu"
            >
              <Menu className="w-5 h-5 text-text" />
            </button>
          </header>
        )}

        {/* Desktop Top Bar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-white/70 backdrop-blur-md z-30 shrink-0">
          <h2 className="text-base font-semibold text-text tracking-tight">{pageTitle}</h2>

          <div className="relative">
            <button
              onClick={() => setIsAccountMenuOpen(v => !v)}
              className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary-dark font-semibold text-xs flex items-center justify-center shrink-0">
                {initial}
              </div>
              <span className="text-xs font-semibold text-text max-w-[140px] truncate">{displayName}</span>
              <ChevronDown className={cn("w-4 h-4 text-muted transition-transform", isAccountMenuOpen && "rotate-180")} />
            </button>

            {isAccountMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsAccountMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-card border border-slate-100 py-2 z-40 animate-fade-up">
                  <div className="px-4 py-2 border-b border-slate-50">
                    <p className="text-xs font-semibold text-text truncate">{displayName}</p>
                    <span className={cn(isAdmin ? "badge-primary" : "badge-neutral", "mt-1.5 !py-0.5 !px-2")}>{roleLabel}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-[#FBF7F6]",
          "pb-24 lg:pb-8" // Extra space for BottomNav on mobile
        )}>
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            <Outlet />
          </div>
        </main>

        {/* BOTTOM NAVIGATION (Mobile Only) */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-secondary/20 lg:hidden z-50 px-4 py-2 pb-safe-area shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)] rounded-t-[2.5rem]">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-1 min-w-[60px] transition-all relative",
                    isActive ? "text-primary" : "text-muted"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-2xl transition-all duration-300",
                    isActive ? "bg-primary/10 scale-110 shadow-inner shadow-primary/5" : "hover:bg-secondary/20"
                  )}>
                    <item.icon className={cn("w-5 h-5", isActive ? "stroke-[3px]" : "stroke-[2px]")} />
                  </div>
                  <span className={cn(
                    "text-[8px] font-semibold uppercase tracking-widest",
                    isActive ? "opacity-100" : "opacity-0"
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="absolute -top-1 w-1 h-1 bg-primary rounded-full" />
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
