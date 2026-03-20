import { useState, useEffect } from 'react';
import { X, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../utils/notificationUtils';
import { Profile } from '../types';
import toast from 'react-hot-toast';

interface AssignModalProps {
  maintenanceId: string;
  maintenanceType: 'preventive' | 'corrective';
  equipmentName: string;
  currentResponsibleId?: string | null;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignModal({
  maintenanceId,
  maintenanceType,
  equipmentName,
  currentResponsibleId,
  onClose,
  onAssigned
}: AssignModalProps) {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string>(currentResponsibleId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, cpf')
        .order('full_name');
      if (error) throw error;
      setEmployees(data || []);
    } catch {
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!selectedId) {
      toast.error('Selecione um responsável');
      return;
    }

    setSaving(true);
    try {
      const table = maintenanceType === 'preventive'
        ? 'preventive_maintenances'
        : 'corrective_maintenances';

      // Atualizar o responsible_id na manutenção
      const { error } = await supabase
        .from(table)
        .update({ responsible_id: selectedId })
        .eq('id', maintenanceId);

      if (error) throw error;

      // Buscar nome do funcionário designado
      const employee = employees.find(e => e.id === selectedId);

      // Notificar o funcionário designado
      await createNotification(
        selectedId,
        'Nova Manutenção Atribuída',
        `Você foi designado para realizar a manutenção ${maintenanceType === 'preventive' ? 'preventiva' : 'corretiva'} do equipamento ${equipmentName}. Acesse a tela de Manutenções para iniciar.`,
        'info',
        '/maintenance'
      );

      toast.success(`Manutenção atribuída para ${employee?.full_name || 'o técnico'}!`);
      onAssigned();
      onClose();
    } catch (error: any) {
      toast.error('Erro ao atribuir: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAssignment() {
    if (!confirm('Remover o responsável desta manutenção?')) return;

    setSaving(true);
    try {
      const table = maintenanceType === 'preventive'
        ? 'preventive_maintenances'
        : 'corrective_maintenances';

      const { error } = await supabase
        .from(table)
        .update({ responsible_id: null })
        .eq('id', maintenanceId);

      if (error) throw error;

      toast.success('Responsável removido.');
      onAssigned();
      onClose();
    } catch (error: any) {
      toast.error('Erro ao remover: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  }

  const currentEmployee = employees.find(e => e.id === currentResponsibleId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-stone-900">Atribuir Responsável</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-6">
          Equipamento: <strong className="text-stone-700">{equipmentName}</strong>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
            {maintenanceType === 'preventive' ? 'Preventiva' : 'Corretiva'}
          </span>
        </p>

        {/* Responsável atual */}
        {currentEmployee && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <UserCheck size={16} className="text-emerald-600" />
              <span className="text-stone-600">Atual:</span>
              <span className="font-bold text-stone-900">{currentEmployee.full_name}</span>
            </div>
            <button
              onClick={handleRemoveAssignment}
              disabled={saving}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Remover
            </button>
          </div>
        )}

        {/* Lista de funcionários */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-stone-400" size={28} />
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {employees.map(employee => (
              <button
                key={employee.id}
                onClick={() => setSelectedId(employee.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedId === employee.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  selectedId === employee.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}>
                  {employee.full_name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${
                    selectedId === employee.id ? 'text-emerald-800' : 'text-stone-800'
                  }`}>
                    {employee.full_name}
                  </p>
                  <p className="text-xs text-stone-400">
                    {employee.role === 'admin' ? 'Administrador' : 'Manutentor'}
                  </p>
                </div>

                {selectedId === employee.id && (
                  <UserCheck size={18} className="text-emerald-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-stone-200 rounded-xl font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || !selectedId || selectedId === currentResponsibleId}
            className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving
              ? <Loader2 size={16} className="animate-spin" />
              : <UserCheck size={16} />
            }
            {saving ? 'Atribuindo...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
