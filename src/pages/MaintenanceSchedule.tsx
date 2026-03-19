import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search
} from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getMaintenanceSchedule, checkAndGeneratePreventives } from '../utils/maintenanceUtils';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';

type StatusFilter = 'all' | 'overdue' | 'soon' | 'ok';

export default function MaintenanceSchedule() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['maintenance-schedule'],
    queryFn: getMaintenanceSchedule
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
    onError: () => {
      toast.error('Erro ao gerar preventivas.');
    }
  });

  const today = startOfDay(new Date());

  // Filtros reais aplicados
  const filteredSchedule = schedule?.filter(item => {
    const isOverdue = isBefore(item.nextDate, today);
    const isSoon = !isOverdue && item.daysRemaining <= 7;
    const isOk = !isOverdue && !isSoon;

    const matchesSearch = item.equipmentName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'overdue' && isOverdue) ||
      (statusFilter === 'soon' && isSoon) ||
      (statusFilter === 'ok' && isOk);

    return matchesSearch && matchesStatus;
  });

  // Contadores para os badges dos filtros
  const counts = React.useMemo(() => {
    if (!schedule) return { overdue: 0, soon: 0, ok: 0 };
    return schedule.reduce(
      (acc, item) => {
        const overdue = isBefore(item.nextDate, today);
        const soon = !overdue && item.daysRemaining <= 7;
        if (overdue) acc.overdue++;
        else if (soon) acc.soon++;
        else acc.ok++;
        return acc;
      },
      { overdue: 0, soon: 0, ok: 0 }
    );
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
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={17} className={generateMutation.isPending ? 'animate-spin' : ''} />
          Verificar e Gerar Pendentes
        </button>
      </header>

      {/* Busca + Filtros funcionais */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-3">
        {/* Busca por nome */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
          <input
            type="text"
            placeholder="Buscar equipamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
          />
        </div>

        {/* Filtro por situação — agora funcional */}
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: 'all', label: 'Todos', count: schedule?.length ?? 0, color: 'bg-stone-900 text-white', inactive: 'bg-stone-100 text-stone-600 hover:bg-stone-200' },
            { key: 'overdue', label: 'Atrasadas', count: counts.overdue, color: 'bg-red-600 text-white', inactive: 'bg-red-50 text-red-600 hover:bg-red-100' },
            { key: 'soon', label: 'Em breve', count: counts.soon, color: 'bg-amber-500 text-white', inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            { key: 'ok', label: 'Em dia', count: counts.ok, color: 'bg-emerald-600 text-white', inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
          ] as const).map(({ key, label, count, color, inactive }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === key ? color : inactive
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
            const isSoon = !isOverdue && item.daysRemaining <= 7;

            return (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.3) }}
                key={item.equipmentId}
                className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                  isOverdue
                    ? 'border-red-200 bg-red-50/30'
                    : isSoon
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-stone-200'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${
                    isOverdue
                      ? 'bg-red-100 text-red-600'
                      : isSoon
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    <Calendar size={22} />
                  </div>
                  <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
                    isOverdue
                      ? 'bg-red-100 text-red-700'
                      : isSoon
                        ? 'bg-amber-100 text-amber-700'
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

                {/* Barra de progresso */}
                <div className="mt-5">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      Prazo
                    </span>
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
    </div>
  );
}
