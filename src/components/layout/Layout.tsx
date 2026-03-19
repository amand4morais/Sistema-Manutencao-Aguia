import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, HardHat, User, LogOut, Menu, X, Shield, Wrench, FileText, Calendar } from 'lucide-react';
import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useAuth } from '../../hooks/useAuth';
import { NotificationCenter } from '../NotificationCenter';

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: HardHat, label: 'Equipamentos', path: '/equipments' },
    { icon: Wrench, label: 'Manutenções', path: '/maintenance' },
    { icon: Calendar, label: 'Cronograma', path: '/maintenance-schedule' },
    { icon: FileText, label: 'Ordens de Serviço', path: '/maintenance-orders' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ];

  const adminItems = [
    { icon: Shield, label: 'Funcionários', path: '/admin/employees' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-stone-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <span className="font-bold text-emerald-800">Águia Florestal</span>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-stone-600">
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-stone-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:block">
          <h1 className="text-xl font-bold text-emerald-900">Águia Florestal</h1>
          <p className="text-xs text-stone-500 uppercase tracking-wider mt-1">Manutenção</p>
        </div>

        <nav className="mt-6 px-4 space-y-1">
          <p className="px-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Menu Principal</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 font-medium" 
                    : "text-stone-600 hover:bg-stone-100"
                )}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {profile?.role === 'admin' && (
            <>
              <p className="px-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-6 mb-2">Administração</p>
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                      isActive 
                        ? "bg-emerald-50 text-emerald-700 font-medium" 
                        : "text-stone-600 hover:bg-stone-100"
                    )}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-stone-100">
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-3 w-full text-stone-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Desktop Header */}
        <header className="hidden md:flex bg-white border-b border-stone-200 px-8 py-4 items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
             <h2 className="text-sm font-medium text-stone-600">
               {menuItems.find(item => item.path === location.pathname)?.label || 
                adminItems.find(item => item.path === location.pathname)?.label || 
                'Sistema de Manutenção'}
             </h2>
          </div>
          <div className="flex items-center gap-6">
            <NotificationCenter />
            <div className="h-8 w-px bg-stone-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-stone-900">{profile?.full_name}</p>
                <p className="text-[10px] text-stone-500 uppercase tracking-wider">{profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border-2 border-emerald-200">
                {profile?.full_name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
