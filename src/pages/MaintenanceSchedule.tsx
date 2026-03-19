import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { format, isBefore, isAfter, addDays, startOfDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getMaintenanceSchedule, checkAndGeneratePreventives } from '../utils/maintenanceUtils';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';

export default function MaintenanceSchedule() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');

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

  const filteredSchedule = schedule?.filter(item => 
    item.equipmentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  const today = startOfDay(new Date());

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
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
          {generateMutation.isPending ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <RefreshCw size={18} />
          )}
          Verificar e Gerar Pendentes
        </button>
      </header>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            placeholder="Buscar equipamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all">
            <Filter size={18} />
            <span>Filtros</span>
          </button>
        </div>
      </div>

      {/* Schedule List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchedule?.map((item, index) => {
          const isOverdue = isBefore(item.nextDate, today);
          const isSoon = !isOverdue && item.daysRemaining <= 7;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={item.equipmentId}
              className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                isOverdue ? 'border-red-200 bg-red-50/30' : 
                isSoon ? 'border-amber-200 bg-amber-50/30' : 'border-stone-200'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${
                  isOverdue ? 'bg-red-100 text-red-600' : 
                  isSoon ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  <Calendar size={24} />
                </div>
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                  isOverdue ? 'bg-red-100 text-red-700' : 
                  isSoon ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {isOverdue ? 'Atrasada' : isSoon ? 'Em breve' : 'Em dia'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-stone-900 mb-1">{item.equipmentName}</h3>
              <p className="text-sm text-stone-500 mb-4">Intervalo: {item.interval} dias</p>

              <div className="space-y-3 pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Última:
                  </span>
                  <span className="font-medium text-stone-700">
                    {format(item.lastDate, "dd/MM/yyyy")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500 flex items-center gap-1.5">
                    <Clock size={14} /> Próxima:
                  </span>
                  <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-stone-900'}`}>
                    {format(item.nextDate, "dd/MM/yyyy")}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-bold text-stone-400 uppercase">Status do Prazo</span>
                  <span className={`text-sm font-bold ${
                    isOverdue ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {isOverdue ? `${Math.abs(item.daysRemaining)} dias de atraso` : `${item.daysRemaining} dias restantes`}
                  </span>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      isOverdue ? 'bg-red-500 w-full' : 
                      isSoon ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ 
                      width: isOverdue ? '100%' : `${Math.max(0, Math.min(100, (1 - item.daysRemaining / item.interval) * 100))}%` 
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredSchedule?.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-stone-300">
          <AlertCircle size={48} className="mx-auto text-stone-300 mb-4" />
          <h3 className="text-lg font-medium text-stone-900">Nenhum agendamento encontrado</h3>
          <p className="text-stone-500">Tente ajustar sua busca ou cadastrar novos equipamentos.</p>
        </div>
      )}
    </div>
  );
}
