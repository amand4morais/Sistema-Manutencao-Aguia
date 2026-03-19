import React, { useState } from 'react';
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Play,
  CheckSquare,
  Filter,
  ClipboardList,
  FileText,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Equipment, PreventiveMaintenance, CorrectiveMaintenance } from '../types';
import ChecklistExecution from '../components/ChecklistExecution';
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
type FilterType = 'all' | 'preventive' | 'corrective';

type MaintenanceItem = (PreventiveMaintenance | CorrectiveMaintenance) & {
  type: 'preventive' | 'corrective';
  equipment?: Equipment;
};

export default function Maintenance() {
  const { profile } = useAuth();
  const { addAction, isOnline } = useOfflineSync();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inspectingMaintenance, setInspectingMaintenance] = useState<MaintenanceItem | null>(null);

  const [newCorrective, setNewCorrective] = useState({
    equipment_id: '',
    problem_description: ''
  });

  // Buscar equipamentos
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipments').select('*').order('name');
      if (error) throw error;
      return data as Equipment[];
    }
  });

  // Buscar manutenções
  const { data: maintenances = [], isLoading: loading } = useQuery({
    queryKey: ['maintenances'],
    queryFn: async () => {
      const [prevRes, corrRes] = await Promise.all([
        supabase
          .from('preventive_maintenances')
          .select('*, equipments(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('corrective_maintenances')
          .select('*, equipments(*)')
          .order('created_at', { ascending: false })
      ]);

      const combined: MaintenanceItem[] = [
        ...(prevRes.data || []).map(m => ({ ...m, type: 'preventive' as const, equipment: m.equipments })),
        ...(corrRes.data || []).map(m => ({ ...m, type: 'corrective' as const, equipment: m.equipments }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined;
    }
  });

  const handleGenerateOS = (m: MaintenanceItem) => {
    const params = new URLSearchParams();
    params.append('equipment_id', m.equipment_id);
    if (m.type === 'corrective') {
      const c = m as CorrectiveMaintenance;
      params.append('corrective_id', m.id);
      params.append('problem', c.problem_description);
      if (c.observations) params.append('observations', c.observations);
    }
    navigate(`/maintenance-orders/new?${params.toString()}`);
  };

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
        toast.error(error.message || 'Erro ao iniciar manutenção');
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
        `${m.type === 'preventive' ? 'Preventiva' : 'Corretiva'} do equipamento ${m.equipment?.name} foi concluída.`,
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
        toast.error(error.message || 'Erro ao concluir manutenção');
      }
    }
  };

  const handleCreateCorrective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCorrective.equipment_id || !newCorrective.problem_description.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      await addAction('corrective_maintenances', 'INSERT', {
        equipment_id: newCorrective.equipment_id,
        problem_description: newCorrective.problem_description,
        status: 'pending'
      });

      const equipment = equipments.find(eq => eq.id === newCorrective.equipment_id);
      await notifyAdmins(
        'Nova Manutenção Corretiva',
        `Equipamento: ${equipment?.name}. Problema: ${newCorrective.problem_description}`,
        'warning',
        '/maintenance'
      );

      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      if (isOnline) toast.success('Corretiva registrada!');
      setIsModalOpen(false);
      setNewCorrective({ equipment_id: '', problem_description: '' });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar corretiva');
    }
  };

  // Filtros aplicados em cascata
  const filteredMaintenances = maintenances.filter(m => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesSearch =
      m.equipment?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.type === 'corrective' &&
        (m as CorrectiveMaintenance).problem_description
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesType && matchesSearch;
  });

  const statusLabels: Record<FilterStatus, string> = {
    all: 'Todas',
    pending: 'Pendentes',
    in_progress: 'Em Curso',
    completed: 'Concluídas'
  };

  const typeLabels: Record<FilterType, string> = {
    all: 'Todos os tipos',
    preventive: 'Preventivas',
    corrective: 'Corretivas'
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Manutenções</h1>
          <p className="text-stone-500">Gerencie as atividades preventivas e corretivas</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Registrar Corretiva</span>
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por equipamento ou descrição do problema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
          />
        </div>

        {/* Filtros em linha */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Filtro por status */}
          <div className="flex bg-white border border-stone-200 rounded-2xl p-1 shadow-sm flex-1">
            {(Object.keys(statusLabels) as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === f
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {statusLabels[f]}
              </button>
            ))}
          </div>

          {/* Filtro por tipo */}
          <div className="flex bg-white border border-stone-200 rounded-2xl p-1 shadow-sm">
            {(Object.keys(typeLabels) as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  typeFilter === f
                    ? f === 'corrective'
                      ? 'bg-red-600 text-white'
                      : f === 'preventive'
                        ? 'bg-amber-500 text-white'
                        : 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {typeLabels[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Contador de resultados */}
        {(statusFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
          <div className="flex items-center justify-between text-sm text-stone-500">
            <span>
              {filteredMaintenances.length} resultado{filteredMaintenances.length !== 1 ? 's' : ''} encontrado{filteredMaintenances.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearchTerm(''); }}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={12} />
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista de Manutenções */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700" />
          </div>
        ) : filteredMaintenances.length > 0 ? (
          filteredMaintenances.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:border-stone-300 transition-all"
            >
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
                        m.type === 'preventive'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {m.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        m.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : m.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
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

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                      {m.status === 'completed' && m.started_at && m.finished_at && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <Wrench size={11} />
                          Duração: {formatDuration(m.started_at, m.finished_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                  {m.status === 'pending' && (
                    <button
                      onClick={() => handleStartMaintenance(m)}
                      className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors"
                    >
                      <Play size={15} />
                      Iniciar
                    </button>
                  )}

                  {m.status === 'in_progress' && (
                    profile?.role === 'admin' || m.responsible_id === profile?.id
                      ? (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleGenerateOS(m)}
                            title="Gerar Ordem de Serviço"
                            className="flex items-center gap-1.5 bg-stone-100 text-stone-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors"
                          >
                            <FileText size={15} />
                            OS
                          </button>
                          <button
                            onClick={() => setInspectingMaintenance(m)}
                            className="flex items-center gap-1.5 bg-stone-100 text-stone-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors"
                          >
                            <ClipboardList size={15} />
                            Checklist
                          </button>
                          <button
                            onClick={() => handleCompleteMaintenance(m)}
                            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                          >
                            <CheckSquare size={15} />
                            Concluir
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic px-2">
                          Em curso por outro técnico
                        </span>
                      )
                  )}

                  {m.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateOS(m)}
                        className="flex items-center gap-1.5 bg-stone-100 text-stone-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-stone-200 transition-colors"
                      >
                        <FileText size={13} />
                        Gerar OS
                      </button>
                      <div className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
                        <CheckCircle2 size={16} />
                        Concluída
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
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

      {/* Checklist Execution */}
      {inspectingMaintenance && (
        <ChecklistExecution
          maintenanceId={inspectingMaintenance.id}
          equipmentId={inspectingMaintenance.equipment_id}
          onClose={() => setInspectingMaintenance(null)}
        />
      )}

      {/* Modal: Nova Corretiva */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-stone-900">Registrar Corretiva</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateCorrective} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Equipamento *
                </label>
                <select
                  required
                  value={newCorrective.equipment_id}
                  onChange={(e) => setNewCorrective({ ...newCorrective, equipment_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Selecione o equipamento</option>
                  {equipments.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.model ? ` — ${e.model}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Descrição do Problema *
                </label>
                <textarea
                  required
                  value={newCorrective.problem_description}
                  onChange={(e) => setNewCorrective({ ...newCorrective, problem_description: e.target.value })}
                  rows={4}
                  placeholder="Descreva o defeito ou problema observado..."
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-stone-200 rounded-xl font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
