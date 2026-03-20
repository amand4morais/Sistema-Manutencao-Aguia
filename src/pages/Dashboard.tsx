import React from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
  ArrowRight, Calendar, LayoutDashboard, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import { useAuthQuery } from '../hooks/useAuthQuery';
import { getMaintenanceSchedule, checkAndGeneratePreventives } from '../utils/maintenanceUtils';
import { toast } from 'react-hot-toast';

const COLORS = ['#059669', '#fbbf24', '#dc2626'];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: dashboardData, isLoading: loading } = useAuthQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today    = new Date();
      const last7Days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i));

      const [
        { count: equipCount },
        { count: prevCount },
        { count: corrCount },
        { data: recentPrev },
        { data: recentCorr },
        { data: completedLast7Days },
        schedule
      ] = await Promise.all([
        supabase.from('equipments').select('*', { count: 'exact', head: true }),
        supabase.from('preventive_maintenances').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('corrective_maintenances').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('preventive_maintenances').select('*, equipments(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('corrective_maintenances').select('*, equipments(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('preventive_maintenances').select('created_at, status').gte('created_at', subDays(today, 7).toISOString()),
        getMaintenanceSchedule()
      ]);

      const stats = {
        totalEquipments:    equipCount || 0,
        pendingPreventive:  prevCount  || 0,
        pendingCorrective:  corrCount  || 0,
        completedLast7Days: completedLast7Days?.filter(m => m.status === 'completed').length || 0
      };

      const recentMaintenances = [
        ...(recentPrev || []).map(m => ({ ...m, type: 'Preventiva' })),
        ...(recentCorr || []).map(m => ({ ...m, type: 'Corretiva' }))
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      const chartData = last7Days.map(date => {
        const dayName  = format(date, 'eee', { locale: ptBR });
        const dayStart = startOfDay(date);
        const dayEnd   = endOfDay(date);
        const day      = completedLast7Days?.filter(m => {
          const d = new Date(m.created_at);
          return d >= dayStart && d <= dayEnd;
        }) || [];
        return {
          name:      dayName,
          concluida: day.filter(m => m.status === 'completed').length,
          pendente:  day.filter(m => m.status === 'pending').length,
        };
      });

      const pieData = [
        { name: 'Preventivas', value: (recentPrev?.length || 0) + (completedLast7Days?.filter(m => m.status === 'completed').length || 0) },
        { name: 'Corretivas',  value: recentCorr?.length || 0 }
      ];

      const upcomingPreventives = schedule
        .filter(item => isBefore(item.nextDate, addDays(today, 15)))
        .slice(0, 5);

      return { stats, recentMaintenances, chartData, pieData, upcomingPreventives };
    },
    staleTime: 1000 * 60 * 5,
  });

  const generateMutation = useMutation({
    mutationFn: checkAndGeneratePreventives,
    onSuccess: (data) => {
      if (data && data.length > 0) toast.success(`${data.length} novas preventivas geradas!`);
      else toast.success('Nenhuma preventiva pendente para gerar.');
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => toast.error('Erro ao gerar preventivas.'),
  });

  if (loading || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700" />
      </div>
    );
  }

  const { stats, recentMaintenances, chartData, pieData, upcomingPreventives } = dashboardData;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Painel de Controle</h1>
          <p className="text-stone-500">Visão geral das manutenções e equipamentos</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              title="Verificar equipamentos com preventiva vencida e criar registros pendentes"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={15} className={generateMutation.isPending ? 'animate-spin' : ''} />
              {generateMutation.isPending ? 'Gerando...' : 'Gerar Preventivas'}
            </button>
          )}
          <div className="bg-white px-4 py-2 rounded-xl border border-stone-200 flex items-center gap-2 text-stone-600 shadow-sm">
            <Calendar size={17} />
            <span className="text-sm font-medium">
              {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<LayoutDashboard className="text-blue-600" />}   label="Equipamentos"   value={stats.totalEquipments}    color="bg-blue-50"    trend="Frota total"   />
        <StatCard icon={<Clock className="text-amber-600" />}             label="Prev. Pendentes" value={stats.pendingPreventive}  color="bg-amber-50"   trend="Aguardando"    />
        <StatCard icon={<AlertTriangle className="text-red-600" />}       label="Corr. Pendentes" value={stats.pendingCorrective}  color="bg-red-50"     trend="Urgente"       />
        <StatCard icon={<CheckCircle2 className="text-emerald-600" />}    label="Concluídas (7d)" value={stats.completedLast7Days} color="bg-emerald-50" trend="Produtividade" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Gráfico */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <h2 className="font-bold text-stone-800 flex items-center gap-2 mb-6">
              <TrendingUp size={19} className="text-emerald-600" /> Atividade Semanal
            </h2>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px' }} />
                  <Bar dataKey="concluida" name="Concluída" fill="#059669" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="pendente"  name="Pendente"  fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Próximas preventivas */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-stone-800 flex items-center gap-2">
                <Calendar size={19} className="text-amber-600" /> Próximas Preventivas
              </h2>
              <Link to="/maintenance-schedule" className="text-emerald-600 text-sm font-medium flex items-center gap-1 hover:underline">
                Ver cronograma <ArrowRight size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingPreventives.length > 0 ? upcomingPreventives.map((item, i) => {
                const isOverdue = isBefore(item.nextDate, startOfDay(new Date()));
                return (
                  <div key={i} className={`p-4 rounded-xl border ${isOverdue ? 'border-red-100 bg-red-50/50' : 'border-stone-100 bg-stone-50/50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-stone-900 truncate pr-2 text-sm">{item.equipmentName}</p>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isOverdue ? 'Atrasada' : 'Em breve'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>Vencimento:</span>
                      <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-stone-700'}`}>
                        {format(item.nextDate, 'dd/MM/yyyy')}
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <p className="col-span-2 text-center text-stone-400 py-6 text-sm italic">
                  Nenhuma preventiva próxima nos próximos 15 dias.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Atividades recentes */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm self-start">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-stone-800">Atividades Recentes</h2>
            <Link to="/maintenance" className="text-emerald-600 text-sm font-medium flex items-center gap-1 hover:underline">
              Ver tudo <ArrowRight size={13} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentMaintenances.length > 0 ? recentMaintenances.map((m, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-100">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${m.type === 'Preventiva' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{m.equipments?.name || 'Equipamento'}</p>
                  <p className="text-xs text-stone-500">{m.type} · {format(new Date(m.created_at), "dd 'de' MMM", { locale: ptBR })}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                  m.status === 'completed'   ? 'bg-emerald-50 text-emerald-700'
                  : m.status === 'in_progress' ? 'bg-blue-50 text-blue-700'
                  : 'bg-stone-100 text-stone-600'
                }`}>
                  {m.status === 'completed' ? 'OK' : m.status === 'in_progress' ? '...' : 'Pendente'}
                </span>
              </div>
            )) : (
              <p className="text-center text-stone-400 py-8 text-sm italic">Nenhuma atividade recente.</p>
            )}
          </div>
          <div className="mt-8 pt-6 border-t border-stone-100">
            <h3 className="text-sm font-bold text-stone-800 mb-4">Distribuição de Tipos</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={38} outerRadius={58} paddingAngle={5} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, trend }: {
  icon: React.ReactNode; label: string; value: number; color: string; trend: string;
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-stone-900">{value}</p>
        <p className="text-[10px] text-stone-400 font-medium">{trend}</p>
      </div>
    </div>
  );
}
