import React, { useState } from 'react';
import {
  Wrench, Clock, CheckCircle2, AlertCircle,
  Search, Play, CheckSquare, ClipboardList,
  FileText, X, Plus, UserPlus, UserCheck
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Equipment, PreventiveMaintenance, CorrectiveMaintenance } from '../types';
import ChecklistExecution from '../components/ChecklistExecution';
import AssignModal from '../components/AssignModal';
import { notifyAdmins } from '../utils/notificationUtils';
import toast from 'react-hot-toast';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDuration(start: string, end: string) {
  const minutes = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours > 0 ? `${hours}h ${remaining}min` : `${minutes}min`;
}

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed';
type FilterType   = 'all' | 'preventive' | 'corrective';

type MaintenanceItem = (PreventiveMaintenance | CorrectiveMaintenance) & {
  type: 'preventive' | 'corrective';
  equipment?: Equipment;
  responsible?: { full_name: string } | null;
};

export default function Maintenance() {
  const { profile } = useAuth();
  const { addAction, isOnline } = useOfflineSync();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter]   = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter]       = useState<FilterType>('all');
  const [searchTerm, setSearchTerm]       = useState('');
  const [inspecting, setInspecting]       = useState<MaintenanceItem | null>(null);
  const [assigning, setAssigning]         = useState<MaintenanceItem | null>(null);

  const { data: maintenances = [], isLoading: loading } = useQuery({
    queryKey: ['maintenances'],
    queryFn: async () => {
      const [prevRes, corrRes] = await Promise.all([
        supabase
          .from('preventive_maintenances')
          .select('*, equipments(*), responsible:profiles!responsible_id(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('corrective_maintenances')
          .select('*, equipments(*), responsible:profiles!responsible_id(full_name)')
          .order('created_at', { ascending: false })
      ]);

      const combined: MaintenanceItem[] = [
        ...(prevRes.data  || []).map(m => ({ ...m, type: 'preventive' as const, equipment: m.equipments, responsible: m.responsible })),
        ...(corrRes.data || []).map(m => ({ ...m, type: 'corrective' as const, equipment: m.equipments, responsible: m.responsible }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined;
    }
  });

  const handleStartMaintenance = async (m: MaintenanceItem) => {
    try {
      const table = m.type === 'preventive' ? 'preventive_maintenances' : 'corrective_maintenances';
      await addAction(table, 'UPDATE', {
        id: m.id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        responsible_id: profile?.id,
        version: m.version
      });
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      if (isOnline) toast.success('Manutenção iniciada!');
    } catch (error: any) {
      if (error.message === 'CONFLITO_VERSAO') {
        toast.error('Conflito: Esta manutenção foi alterada por outro usuário.');
        queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      } else {
        toast.error(error.message || 'Erro ao iniciar');
      }
    }
  };

  const handleCompleteMaintenance = async (m: MaintenanceItem) => {
    const observation = prompt('Observações finais (opcional):');
    try {
      const table = m.type === 'preventive' ? 'preventive_maintenances' : 'corrective_maintenances';
      const payload: any = {
        id: m.id,
        status: 'completed',
        finished_at: new Date().toISOString(),
        version: m.version
      };
      if (m.type === 'preventive') payload.general_observation = observation;
      else payload.observations = observation;

      await addAction(table, 'UPDATE', payload);

      await notifyAdmins(
        'Manutenção Concluída',
        `${m.type === 'preventive' ? 'Preventiva' : 'Corretiva'} do equipamento ${m.equipment?.name} concluída.`,
        'success',
        '/maintenance'
      );

      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      if (isOnline) toast.success('Manutenção concluída!');
    } catch (error: any) {
      if (error.message === 'CONFLITO_VERSAO') {
        toast.error('Conflito: Outro usuário já atualizou este registro.');
        queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      } else {
        toast.error(error.message || 'Erro ao concluir');
      }
    }
  };

  const filteredMaintenances = maintenances.filter(m => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesType   = typeFilter   === 'all' || m.type   === typeFilter;
    const matchesSearch =
      m.equipment?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.type === 'corrective' &&
        (m as CorrectiveMaintenance).problem_description?.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesType && matchesSearch;
  });

  const statusLabels: Record<FilterStatus, string> = {
    all: 'Todas', pending: 'Pendentes', in_progress: 'Em Curso', completed: 'Concluídas'
  };
  const typeLabels: Record<FilterType, string> = {
    all: 'Todos os tipos', preventive: 'Preventivas', corrective: 'Corretivas'
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Manutenções</h1>
          <p className="text-stone-500">Gerencie as atividades preventivas e corretivas</p>
        </div>
        <Link
          to="/maintenance-orders/new"
          className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Abrir OS / Corretiva</span>
        </Link>
      </div>

      {/* Aviso do fluxo */}
      <div className="mb-5 p-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700 flex items-start gap-2">
        <FileText size={16} className="shrink-0 mt-0.5" />
        <span>
          Para registrar uma corretiva, abra uma <strong>Ordem de Serviço</strong>.
          {isAdmin && <> Após criada, use o botão <strong>Atribuir</strong> para designar um técnico responsável.</>}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por equipamento ou descrição do problema..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex bg-white border border-stone-200 rounded-2xl p-1 shadow-sm flex-1">
            {(Object.keys(statusLabels) as FilterStatus[]).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === f ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50'
                }`}>
                {statusLabels[f]}
              </button>
            ))}
          </div>
          <div className="flex bg-white border border-stone-200 rounded-2xl p-1 shadow-sm">
            {(Object.keys(typeLabels) as FilterType[]).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  typeFilter === f
                    ? f === 'corrective' ? 'bg-red-600 text-white'
                    : f === 'preventive' ? 'bg-amber-500 text-white'
                    : 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:bg-stone-50'
                }`}>
                {typeLabels[f]}
              </button>
            ))}
          </div>
        </div>

        {(statusFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
          <div className="flex items-center justify-between text-sm text-stone-500">
            <span>{filteredMaintenances.length} resultado{filteredMaintenances.length !== 1 ? 's' : ''}</span>
            <button
              onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearchTerm(''); }}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={12} /> Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700" />
          </div>
        ) : filteredMaintenances.length > 0 ? (
          filteredMaintenances.map(m => {
            const isResponsible = m.responsible_id === profile?.id;
            const canAct        = isAdmin || isResponsible;
            const hasResponsible = !!m.responsible_id;

            return (
              <div key={m.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:border-stone-300 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info */}
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      m.type === 'preventive' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {m.type === 'preventive' ? <Clock size={22} /> : <AlertCircle size={22} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-bold text-stone-900">{m.equipment?.name || 'Equipamento'}</h3>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          m.type === 'preventive' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {m.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          m.status === 'completed'   ? 'bg-emerald-100 text-emerald-700'
                          : m.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                          : 'bg-stone-100 text-stone-600'
                        }`}>
                          {m.status === 'completed' ? 'Concluída' : m.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                        </span>
                      </div>

                      <p className="text-sm text-stone-500 line-clamp-1">
                        {m.type === 'corrective'
                          ? (m as CorrectiveMaintenance).problem_description
                          : 'Manutenção periódica programada'}
                      </p>

                      {/* Responsável */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {hasResponsible ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                            <UserCheck size={11} />
                            {m.responsible?.full_name || 'Responsável atribuído'}
                          </span>
                        ) : (
                          m.status === 'pending' && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                              <UserPlus size={11} />
                              Sem responsável
                            </span>
                          )
                        )}
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Clock size={11} />
                          {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {m.status === 'completed' && m.started_at && m.finished_at && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <Wrench size={11} />
                            {formatDuration(m.started_at, m.finished_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">

                    {/* Botão Atribuir — apenas admin, apenas em manutenções pendentes ou em andamento */}
                    {isAdmin && m.status !== 'completed' && (
                      <button
                        onClick={() => setAssigning(m)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          hasResponsible
                            ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        <UserPlus size={15} />
                        {hasResponsible ? 'Reatribuir' : 'Atribuir'}
                      </button>
                    )}

                    {/* Iniciar — pendente, sem responsável (qualquer técnico pega) OU responsável é o próprio */}
                    {m.status === 'pending' && (!hasResponsible || isResponsible || isAdmin) && (
                      <button
                        onClick={() => handleStartMaintenance(m)}
                        className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors"
                      >
                        <Play size={15} /> Iniciar
                      </button>
                    )}

                    {/* Em andamento */}
                    {m.status === 'in_progress' && (
                      canAct ? (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setInspecting(m)}
                            className="flex items-center gap-1.5 bg-stone-100 text-stone-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors"
                          >
                            <ClipboardList size={15} /> Checklist
                          </button>
                          <button
                            onClick={() => handleCompleteMaintenance(m)}
                            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                          >
                            <CheckSquare size={15} /> Concluir
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic px-2">
                          Em curso por outro técnico
                        </span>
                      )
                    )}

                    {m.status === 'completed' && (
                      <div className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
                        <CheckCircle2 size={16} /> Concluída
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-300">
            <Wrench size={44} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-500 font-medium">Nenhuma manutenção encontrada</p>
            {(statusFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearchTerm(''); }}
                className="mt-2 text-emerald-700 text-sm hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de checklist */}
      {inspecting && (
        <ChecklistExecution
          maintenanceId={inspecting.id}
          equipmentId={inspecting.equipment_id}
          onClose={() => setInspecting(null)}
        />
      )}

      {/* Modal de atribuição */}
      {assigning && (
        <AssignModal
          maintenanceId={assigning.id}
          maintenanceType={assigning.type}
          equipmentName={assigning.equipment?.name || 'Equipamento'}
          currentResponsibleId={assigning.responsible_id}
          onClose={() => setAssigning(null)}
          onAssigned={() => queryClient.invalidateQueries({ queryKey: ['maintenances'] })}
        />
      )}
    </div>
  );
}
