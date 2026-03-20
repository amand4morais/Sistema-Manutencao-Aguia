import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Clock, AlertCircle, CheckCircle2,
  RefreshCw, Search, UserPlus, UserCheck
} from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { getMaintenanceSchedule, checkAndGeneratePreventives } from '../utils/maintenanceUtils';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import AssignModal from '../components/AssignModal';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';

type StatusFilter = 'all' | 'overdue' | 'soon' | 'ok';

interface ScheduleItemWithMaintenance {
  equipmentId: string;
  equipmentName: string;
  lastDate: Date;
  nextDate: Date;
  daysRemaining: number;
  interval: number;
  pendingMaintenanceId?: string;
  responsibleId?: string | null;
  responsibleName?: string | null;
}

export default function MaintenanceSchedule() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm]     = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [assigning, setAssigning]       = React.useState<ScheduleItemWithMaintenance | null>(null);

  const isAdmin = profile?.role === 'admin';
  const today   = startOfDay(new Date());

  // Buscar cronograma + dados de manutenções pendentes com responsável
  const { data: schedule, isLoading } = useQuery({
    queryKey: ['maintenance-schedule'],
    queryFn: async () => {
      const base = await getMaintenanceSchedule();

      // Para cada equipamento, buscar preventiva pendente/em andamento e seu responsável
      const enriched: ScheduleItemWithMaintenance[] = await Promise.all(
        base.map(async item => {
          const { data: pending } = await supabase
            .from('preventive_maintenances')
            .select('id, responsible_id, responsible:profiles!responsible_id(full_name)')
            .eq('equipment_id', item.equipmentId)
            .in('status', ['pending', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...item,
            pendingMaintenanceId: pending?.id ?? undefined,
            responsibleId:   (pending as any)?.responsible_id   ?? null,
            responsibleName: (pending as any)?.responsible?.full_name ?? null
          };
        })
      );

      return enriched;
    }
  });

  const generateMutation = useMutation({
    mutationFn: checkAndGeneratePreventives,
    onSuccess: (data) => {
      if (data && data.length > 0) {
        toast.success(`${data.length} novas preventivas geradas!`);
      } else {
        toast.success('Nenhuma preventiva pendente para gerar.');
      }
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: () => toast.error('Erro ao gerar preventivas.')
  });

  const filteredSchedule = schedule?.filter(item => {
    const isOverdue = isBefore(item.nextDate, today);
    const isSoon    = !isOverdue && item.daysRemaining <= 7;
    const isOk      = !isOverdue && !isSoon;

    const matchesSearch = item.equipmentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all'    ? true :
      statusFilter === 'overdue' ? isOverdue :
      statusFilter === 'soon'    ? isSoon :
      isOk;

    return matchesSearch && matchesStatus;
  });

  const counts = React.useMemo(() => {
    if (!schedule) return { overdue: 0, soon: 0, ok: 0 };
    return schedule.reduce((acc, item) => {
      const overdue = isBefore(item.nextDate, today);
      const soon    = !overdue && item.daysRemaining <= 7;
      if (overdue) acc.overdue++;
      else if (soon) acc.soon++;
      else acc.ok++;
      return acc;
    }, { overdue: 0, soon: 0, ok: 0 });
  }, [schedule]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Cronograma de Preventivas</h1>
          <p className="text-stone-500">Planejamento e controle de manutenções periódicas</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={17} className={generateMutation.isPending ? 'animate-spin' : ''} />
            Verificar e Gerar Pendentes
          </button>
        )}
      </header>

      {/* Busca + Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
          <input
            type="text"
            placeholder="Buscar equipamento..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: 'all',     label: 'Todos',     count: schedule?.length ?? 0, active: 'bg-stone-900 text-white',    inactive: 'bg-stone-100 text-stone-600 hover:bg-stone-200' },
            { key: 'overdue', label: 'Atrasadas', count: counts.overdue,         active: 'bg-red-600 text-white',      inactive: 'bg-red-50 text-red-600 hover:bg-red-100' },
            { key: 'soon',    label: 'Em breve',  count: counts.soon,            active: 'bg-amber-500 text-white',    inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            { key: 'ok',      label: 'Em dia',    count: counts.ok,              active: 'bg-emerald-600 text-white',  inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
          ] as const).map(({ key, label, count, active, inactive }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === key ? active : inactive
              }`}
            >
              {label}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                statusFilter === key ? 'bg-white/20' : 'bg-black/10'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid de cards */}
      {filteredSchedule && filteredSchedule.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSchedule.map((item, index) => {
            const isOverdue = isBefore(item.nextDate, today);
            const isSoon    = !isOverdue && item.daysRemaining <= 7;

            return (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.3) }}
                key={item.equipmentId}
                className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                  isOverdue ? 'border-red-200 bg-red-50/30'
                  : isSoon  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-stone-200'
                }`}
              >
                {/* Topo do card */}
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${
                    isOverdue ? 'bg-red-100 text-red-600'
                    : isSoon  ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    <Calendar size={22} />
                  </div>
                  <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
                    isOverdue ? 'bg-red-100 text-red-700'
                    : isSoon  ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isOverdue ? 'Atrasada' : isSoon ? 'Em breve' : 'Em dia'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-stone-900 mb-0.5 leading-tight">
                  {item.equipmentName}
                </h3>
                <p className="text-xs text-stone-400 mb-4">
                  Intervalo: a cada {item.interval} dias
                </p>

                {/* Datas */}
                <div className="space-y-2.5 pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500 flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Última:
                    </span>
                    <span className="font-medium text-stone-700">
                      {format(item.lastDate, 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500 flex items-center gap-1.5">
                      <Clock size={13} /> Próxima:
                    </span>
                    <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-stone-900'}`}>
                      {format(item.nextDate, 'dd/MM/yyyy')}
                    </span>
                  </div>
                </div>

                {/* Responsável atual */}
                <div className="mt-3 pt-3 border-t border-stone-100">
                  {item.responsibleName ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                      <UserCheck size={13} />
                      <span>{item.responsibleName}</span>
                    </div>
                  ) : item.pendingMaintenanceId ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <UserPlus size={13} />
                      <span>Sem responsável atribuído</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-stone-400">
                      <span>Nenhuma preventiva pendente</span>
                    </div>
                  )}
                </div>

                {/* Barra de progresso */}
                <div className="mt-4">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Prazo</span>
                    <span className={`text-xs font-bold ${
                      isOverdue ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {isOverdue
                        ? `${Math.abs(item.daysRemaining)}d de atraso`
                        : `${item.daysRemaining}d restantes`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOverdue ? 'bg-red-500' : isSoon ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: isOverdue
                          ? '100%'
                          : `${Math.max(5, Math.min(100, (1 - item.daysRemaining / item.interval) * 100))}%`
                      }}
                    />
                  </div>
                </div>

                {/* Botão Atribuir — apenas admin, apenas se houver preventiva pendente */}
                {isAdmin && item.pendingMaintenanceId && (
                  <button
                    onClick={() => setAssigning(item)}
                    className={`mt-4 w-full py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      item.responsibleName
                        ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    <UserPlus size={15} />
                    {item.responsibleName ? 'Reatribuir técnico' : 'Atribuir técnico'}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-stone-300">
          <AlertCircle size={44} className="mx-auto text-stone-300 mb-4" />
          <h3 className="text-base font-semibold text-stone-700">Nenhum agendamento encontrado</h3>
          <p className="text-stone-400 text-sm mt-1">
            {searchTerm || statusFilter !== 'all'
              ? 'Tente ajustar os filtros.'
              : 'Cadastre equipamentos para visualizar o cronograma.'}
          </p>
        </div>
      )}

      {/* Modal de atribuição */}
      {assigning && assigning.pendingMaintenanceId && (
        <AssignModal
          maintenanceId={assigning.pendingMaintenanceId}
          maintenanceType="preventive"
          equipmentName={assigning.equipmentName}
          currentResponsibleId={assigning.responsibleId}
          onClose={() => setAssigning(null)}
          onAssigned={() => queryClient.invalidateQueries({ queryKey: ['maintenance-schedule'] })}
        />
      )}
    </div>
  );
}
