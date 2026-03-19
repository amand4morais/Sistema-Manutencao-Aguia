import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Plus,
  Play,
  CheckSquare,
  ChevronRight,
  Filter,
  ClipboardList,
  FileText
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

// Função auxiliar para formatar duração
function formatDuration(start: string, end: string) {
  const minutes = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}min`;
  }
  return `${minutes}min`;
}

type MaintenanceItem = (PreventiveMaintenance | CorrectiveMaintenance) & { 
  type: 'preventive' | 'corrective';
  equipment?: Equipment;
};

import { seedChecklists } from '../utils/seedData';

export default function Maintenance() {
  const { profile } = useAuth();
  const { addAction, isOnline } = useOfflineSync();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleGenerateOS = (m: MaintenanceItem) => {
    const params = new URLSearchParams();
    params.append('equipment_id', m.equipment_id);
    if (m.type === 'corrective') {
      const corrective = m as CorrectiveMaintenance;
      params.append('corrective_id', m.id);
      params.append('problem', corrective.problem_description);
      if (corrective.observations) params.append('observations', corrective.observations);
    }
    navigate(`/maintenance-orders/new?${params.toString()}`);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedChecklists();
      toast.success('Checklists populados com sucesso!');
    } catch (error) {
      toast.error('Erro ao popular checklists');
    } finally {
      setIsSeeding(false);
    }
  };
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inspectingMaintenance, setInspectingMaintenance] = useState<MaintenanceItem | null>(null);
  
  const [newCorrective, setNewCorrective] = useState({
    equipment_id: '',
    problem_description: ''
  });

  // Fetch Equipments
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipments').select('*').order('name');
      if (error) throw error;
      return data as Equipment[];
    }
  });

  // Fetch Maintenances
  const { data: maintenances = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['maintenances'],
    queryFn: async () => {
      const [prevRes, corrRes] = await Promise.all([
        supabase.from('preventive_maintenances').select('*, equipments(*)').order('created_at', { ascending: false }),
        supabase.from('corrective_maintenances').select('*, equipments(*)').order('created_at', { ascending: false })
      ]);

      const combined: MaintenanceItem[] = [
        ...(prevRes.data || []).map(m => ({ ...m, type: 'preventive' as const, equipment: m.equipments })),
        ...(corrRes.data || []).map(m => ({ ...m, type: 'corrective' as const, equipment: m.equipments }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined;
    }
  });

  const handleStartMaintenance = async (m: MaintenanceItem) => {
    try {
      const table = m.type === 'preventive' ? 'preventive_maintenances' : 'corrective_maintenances';
      const payload = { 
        id: m.id,
        status: 'in_progress', 
        started_at: new Date().toISOString(),
        responsible_id: profile?.id,
        version: m.version // Passamos a versão atual
      };

      await addAction(table, 'UPDATE', payload);
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      if (isOnline) toast.success('Manutenção iniciada!');
    } catch (error: any) {
      if (error.message === 'CONFLITO_VERSAO') {
        toast.error('Conflito: Esta manutenção foi alterada por outro usuário.');
        queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      } else {
        toast.error(error.message);
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
        version: m.version // Passamos a versão atual
      };
      
      if (m.type === 'preventive') payload.general_observation = observation;
      else payload.observations = observation;

      await addAction(table, 'UPDATE', payload);

      // Notificar admins sobre conclusão
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
        toast.error(error.message);
      }
    }
  };

  const handleCreateCorrective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCorrective.equipment_id || !newCorrective.problem_description) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      const payload = {
        equipment_id: newCorrective.equipment_id,
        problem_description: newCorrective.problem_description,
        status: 'pending'
      };

      await addAction('corrective_maintenances', 'INSERT', payload);
      
      // Notificar admins
      const equipment = equipments.find(eq => eq.id === newCorrective.equipment_id);
      await notifyAdmins(
        'Nova Manutenção Corretiva',
        `Equipamento: ${equipment?.name}. Problema: ${newCorrective.problem_description}`,
        'warning',
        '/maintenance'
      );

      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      if (isOnline) toast.success('Manutenção corretiva registrada!');
      setIsModalOpen(false);
      setNewCorrective({ equipment_id: '', problem_description: '' });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredMaintenances = maintenances.filter(m => {
    const matchesFilter = filter === 'all' || m.status === filter;
    const matchesSearch = m.equipment?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (m.type === 'corrective' && (m as CorrectiveMaintenance).problem_description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Manutenções</h1>
          <p className="text-stone-500">Gerencie as atividades preventivas e corretivas</p>
        </div>
        
        <div className="flex gap-3">
          {profile?.role === 'admin' && (
            <button 
              onClick={handleSeed}
              disabled={isSeeding}
              className="bg-stone-100 text-stone-600 px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              <ClipboardList size={20} />
              <span>{isSeeding ? 'Populando...' : 'Popular Checklists'}</span>
            </button>
          )}
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Registrar Corretiva</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por equipamento ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
          />
        </div>
        
        <div className="flex bg-white border border-stone-200 rounded-2xl p-1 shadow-sm">
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'in_progress' ? 'Em Curso' : 'Concluídas'}
            </button>
          ))}
        </div>
      </div>

      {/* Maintenance List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
          </div>
        ) : filteredMaintenances.length > 0 ? (
          filteredMaintenances.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm hover:border-stone-300 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    m.type === 'preventive' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {m.type === 'preventive' ? <Clock size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-stone-900">{m.equipment?.name || 'Equipamento'}</h3>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        m.type === 'preventive' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 line-clamp-1">
                      {m.type === 'corrective' ? (m as CorrectiveMaintenance).problem_description : 'Manutenção periódica programada'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-stone-400">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        Criado em: {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                      {m.status !== 'pending' && (
                        <span className="flex items-center gap-1">
                          <Wrench size={14} />
                          Status: {m.status === 'in_progress' ? 'Em andamento' : 'Concluída'}
                        </span>
                      )}
                      {m.status === 'completed' && m.started_at && m.finished_at && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <Clock size={14} />
                          Duração: {formatDuration(m.started_at, m.finished_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Regra RLS: Pode iniciar se estiver pendente OU se já for o responsável */}
                  {m.status === 'pending' && (
                    <button 
                      onClick={() => handleStartMaintenance(m)}
                      className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors"
                    >
                      <Play size={16} />
                      Iniciar
                    </button>
                  )}
                  
                  {/* Regra RLS: Pode concluir se for o responsável OU se for admin */}
                  {m.status === 'in_progress' && (profile?.role === 'admin' || m.responsible_id === profile?.id) && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleGenerateOS(m)}
                        className="flex items-center gap-2 bg-stone-100 text-stone-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors"
                        title="Gerar Ordem de Serviço"
                      >
                        <FileText size={16} />
                        OS
                      </button>
                      <button 
                        onClick={() => setInspectingMaintenance(m)}
                        className="flex items-center gap-2 bg-stone-100 text-stone-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors"
                      >
                        <ClipboardList size={16} />
                        Checklist
                      </button>
                      <button 
                        onClick={() => handleCompleteMaintenance(m)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        <CheckSquare size={16} />
                        Concluir
                      </button>
                    </div>
                  )}

                  {/* Se estiver em curso mas não for o responsável nem admin, mostra aviso */}
                  {m.status === 'in_progress' && profile?.role !== 'admin' && m.responsible_id !== profile?.id && (
                    <span className="text-xs text-stone-400 italic">Em curso por outro técnico</span>
                  )}
                  {m.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleGenerateOS(m)}
                        className="flex items-center gap-2 bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-stone-200 transition-colors"
                      >
                        <FileText size={14} />
                        Gerar OS
                      </button>
                      <div className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
                        <CheckCircle2 size={18} />
                        Concluída
                      </div>
                    </div>
                  )}
                  <button className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-lg transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-stone-300">
            <Wrench size={48} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-500">Nenhuma manutenção encontrada</p>
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

      {/* New Corrective Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-stone-900">Registrar Corretiva</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCorrective} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Equipamento</label>
                <select 
                  value={newCorrective.equipment_id}
                  onChange={(e) => setNewCorrective({...newCorrective, equipment_id: e.target.value})}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Selecione o equipamento</option>
                  {equipments.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.model})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Descrição do Problema</label>
                <textarea 
                  value={newCorrective.problem_description}
                  onChange={(e) => setNewCorrective({...newCorrective, problem_description: e.target.value})}
                  rows={4}
                  placeholder="Descreva o defeito ou problema observado..."
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 mt-8">
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
