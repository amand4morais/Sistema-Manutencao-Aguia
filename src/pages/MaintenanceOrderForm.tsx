import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Save, Printer, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MaintenanceOrder, Equipment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { notifyAdmins } from '../utils/notificationUtils';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function MaintenanceOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { addAction } = useOfflineSync();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  const [formData, setFormData] = useState<Partial<MaintenanceOrder>>({
    number: '',
    requester_name: '',
    establishment: 'Matriz',
    cost_center_code: '',
    cost_center_name: '',
    equipment_id: '',
    linked_asset_number: '',
    problem_description: '',
    cause_description: '',
    stop_date: format(new Date(), 'yyyy-MM-dd'),
    stop_hour: format(new Date(), 'HH:mm'),
    service_by: '',
    time_entries: [
      { date: format(new Date(), 'yyyy-MM-dd'), morning: '', afternoon: '', night: '' }
    ],
    services_performed: '',
    observations: '',
    status: 'open',
    technician_id: profile?.id || ''
  });

  useEffect(() => {
    fetchInitialData();
  }, [id, location.search]);

  async function fetchInitialData() {
    try {
      setLoading(true);

      // Buscar equipamentos
      const { data: eqData, error: eqError } = await supabase
        .from('equipments')
        .select('*')
        .order('name');

      if (eqError) {
        console.error('Erro ao carregar equipamentos:', eqError);
      }
      setEquipments(eqData || []);

      const isEditing = id && id !== 'new';

      if (isEditing) {
        // Carregar OS existente — sem join para evitar falha de FK
        const { data: orderData, error: orderError } = await supabase
          .from('maintenance_orders')
          .select('*')
          .eq('id', id)
          .single();

        if (orderError) {
          if (orderError.code === 'PGRST116') {
            toast.error('Ordem de Serviço não encontrada.');
            navigate('/maintenance-orders');
            return;
          }
          throw orderError;
        }

        if (orderData) {
          // time_entries pode vir como string JSON dependendo do tipo da coluna
          const timeEntries = typeof orderData.time_entries === 'string'
            ? JSON.parse(orderData.time_entries)
            : (orderData.time_entries || []);

          setFormData({ ...orderData, time_entries: timeEntries });
        }
      } else {
        // Nova OS — pré-preencher a partir dos query params
        const params = new URLSearchParams(location.search);
        const equipmentId = params.get('equipment_id');
        const correctiveId = params.get('corrective_id');
        const problem = params.get('problem');
        const observations = params.get('observations');

        setFormData(prev => ({
          ...prev,
          number: Math.floor(10000 + Math.random() * 90000).toString(),
          requester_name: profile?.full_name || '',
          equipment_id: equipmentId || '',
          corrective_id: correctiveId || null,
          problem_description: problem || '',
          observations: observations || '',
          service_by: profile?.full_name || '',
          technician_id: profile?.id || ''
        }));
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados da OS:', error);
      toast.error('Erro ao carregar dados: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  const handleAddTimeEntry = () => {
    setFormData(prev => ({
      ...prev,
      time_entries: [
        ...(prev.time_entries || []),
        { date: format(new Date(), 'yyyy-MM-dd'), morning: '', afternoon: '', night: '' }
      ]
    }));
  };

  const handleRemoveTimeEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      time_entries: (prev.time_entries || []).filter((_, i) => i !== index)
    }));
  };

  const handleTimeEntryChange = (index: number, field: string, value: string) => {
    const newEntries = [...(formData.time_entries || [])];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setFormData(prev => ({ ...prev, time_entries: newEntries }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.equipment_id) {
      toast.error('Selecione um equipamento');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        technician_id: profile?.id || formData.technician_id,
        updated_at: new Date().toISOString()
      };

      const isEditing = id && id !== 'new';

      if (isEditing) {
        await addAction('maintenance_orders', 'UPDATE', { ...payload, id });
        toast.success('Ordem de Serviço atualizada!');
      } else {
        await addAction('maintenance_orders', 'INSERT', payload);

        const equipment = equipments.find(eq => eq.id === formData.equipment_id);
        await notifyAdmins(
          'Nova Ordem de Serviço',
          `OS #${formData.number} criada para o equipamento ${equipment?.name || 'desconhecido'}.`,
          'info',
          '/maintenance-orders'
        );

        toast.success('Ordem de Serviço criada!');
      }

      navigate('/maintenance-orders');
    } catch (error: any) {
      console.error('Erro ao salvar OS:', error);
      toast.error('Erro ao salvar Ordem de Serviço: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto print:p-0">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <button
          onClick={() => navigate('/maintenance-orders')}
          className="text-stone-500 hover:text-stone-800 flex items-center gap-2 transition-colors"
        >
          <ChevronLeft size={20} />
          <span>Voltar</span>
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 border border-stone-200 rounded-xl font-medium text-stone-600 hover:bg-stone-50 flex items-center gap-2 transition-colors"
          >
            <Printer size={18} />
            <span>Imprimir</span>
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-700 text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <Save size={18} />
            }
            <span>Salvar OS</span>
          </button>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white border border-stone-300 shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* Header */}
        <div className="p-6 border-b border-stone-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-stone-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-800 rounded flex items-center justify-center text-white font-bold text-xs text-center leading-tight">
              Águia<br />Florestal
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 uppercase tracking-tight">
                Ordem de Serviço de Manutenção
              </h1>
              <div className="flex gap-4 mt-1">
                {(['Matriz', 'Itaiacoca', 'Distrito'] as const).map(loc => (
                  <label key={loc} className="flex items-center gap-2 text-xs font-medium text-stone-600 cursor-pointer">
                    <input
                      type="radio"
                      name="establishment"
                      value={loc}
                      checked={formData.establishment === loc}
                      onChange={e => setFormData({ ...formData, establishment: e.target.value as any })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    {loc}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-stone-400 font-bold uppercase mb-1">FORM-MAN-001 Rev-01</div>
            <div className="text-3xl font-bold text-red-600 tabular-nums">{formData.number}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-0">
          {/* Solicitante */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-stone-300">
            <div className="p-4 md:col-span-2 border-r border-stone-300">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Solicitante</label>
              <input
                type="text"
                value={formData.requester_name}
                onChange={e => setFormData({ ...formData, requester_name: e.target.value })}
                placeholder="Nome do solicitante"
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300"
              />
            </div>
            <div className="p-4">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Estabelecimento</label>
              <div className="text-sm font-medium text-stone-700">{formData.establishment}</div>
            </div>
          </div>

          {/* Centro de Custo */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-stone-300">
            <div className="p-4 border-r border-stone-300">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Centro Custo (Código)</label>
              <input
                type="text"
                value={formData.cost_center_code}
                onChange={e => setFormData({ ...formData, cost_center_code: e.target.value })}
                placeholder="Código"
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300"
              />
            </div>
            <div className="p-4 md:col-span-2">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Nome do Centro de Custo</label>
              <input
                type="text"
                value={formData.cost_center_name}
                onChange={e => setFormData({ ...formData, cost_center_name: e.target.value })}
                placeholder="Nome do centro de custo"
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300"
              />
            </div>
          </div>

          {/* Equipamento */}
          <div className="grid grid-cols-1 md:grid-cols-4 border-b border-stone-300">
            <div className="p-4 md:col-span-2 border-r border-stone-300">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Bem (Equipamento) *</label>
              <select
                required
                value={formData.equipment_id}
                onChange={e => setFormData({ ...formData, equipment_id: e.target.value })}
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium appearance-none"
              >
                <option value="">Selecione um equipamento</option>
                {equipments.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}{eq.serial_number ? ` (${eq.serial_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-4 border-r border-stone-300">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Nº do Bem</label>
              <div className="text-sm font-medium text-stone-700">
                {equipments.find(e => e.id === formData.equipment_id)?.serial_number || '-'}
              </div>
            </div>
            <div className="p-4">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Vinc. ao Bem nº</label>
              <input
                type="text"
                value={formData.linked_asset_number || ''}
                onChange={e => setFormData({ ...formData, linked_asset_number: e.target.value })}
                placeholder="Vínculo"
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300"
              />
            </div>
          </div>

          {/* Problema */}
          <div className="p-4 border-b border-stone-300">
            <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Problema</label>
            <textarea
              rows={2}
              value={formData.problem_description}
              onChange={e => setFormData({ ...formData, problem_description: e.target.value })}
              placeholder="Descreva o problema identificado"
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300 resize-none"
            />
          </div>

          {/* Causa */}
          <div className="p-4 border-b border-stone-300">
            <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Causa</label>
            <textarea
              rows={2}
              value={formData.cause_description}
              onChange={e => setFormData({ ...formData, cause_description: e.target.value })}
              placeholder="Causa provável do problema"
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300 resize-none"
            />
          </div>

          {/* Data de parada + Atendente */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-stone-300">
            <div className="p-4 border-r border-stone-300 flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Parada do equipamento</label>
                <input
                  type="date"
                  value={formData.stop_date || ''}
                  onChange={e => setFormData({ ...formData, stop_date: e.target.value })}
                  className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium"
                />
              </div>
              <div className="w-24">
                <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Hora</label>
                <input
                  type="time"
                  value={formData.stop_hour || ''}
                  onChange={e => setFormData({ ...formData, stop_hour: e.target.value })}
                  className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium"
                />
              </div>
            </div>
            <div className="p-4">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Atendimento por</label>
              <input
                type="text"
                value={formData.service_by}
                onChange={e => setFormData({ ...formData, service_by: e.target.value })}
                placeholder="Nome do técnico/atendente"
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300"
              />
            </div>
          </div>

          {/* Tabela de horas */}
          <div className="border-b border-stone-300 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-300">
                <tr>
                  <th className="p-2 text-left text-[10px] font-bold text-emerald-800 uppercase border-r border-stone-300 w-32">Data</th>
                  <th className="p-2 text-center text-[10px] font-bold text-emerald-800 uppercase border-r border-stone-300">Manhã</th>
                  <th className="p-2 text-center text-[10px] font-bold text-emerald-800 uppercase border-r border-stone-300">Tarde</th>
                  <th className="p-2 text-center text-[10px] font-bold text-emerald-800 uppercase border-r border-stone-300">Noite</th>
                  <th className="p-2 w-10 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {(formData.time_entries || []).map((entry, idx) => (
                  <tr key={idx} className="border-b border-stone-200 last:border-0">
                    <td className="p-0 border-r border-stone-300">
                      <input
                        type="date"
                        value={entry.date}
                        onChange={e => handleTimeEntryChange(idx, 'date', e.target.value)}
                        className="w-full bg-transparent border-none p-2 focus:ring-0 text-xs font-medium"
                      />
                    </td>
                    <td className="p-0 border-r border-stone-300">
                      <input
                        type="text"
                        value={entry.morning}
                        onChange={e => handleTimeEntryChange(idx, 'morning', e.target.value)}
                        className="w-full bg-transparent border-none p-2 focus:ring-0 text-xs text-center font-medium"
                      />
                    </td>
                    <td className="p-0 border-r border-stone-300">
                      <input
                        type="text"
                        value={entry.afternoon}
                        onChange={e => handleTimeEntryChange(idx, 'afternoon', e.target.value)}
                        className="w-full bg-transparent border-none p-2 focus:ring-0 text-xs text-center font-medium"
                      />
                    </td>
                    <td className="p-0 border-r border-stone-300">
                      <input
                        type="text"
                        value={entry.night}
                        onChange={e => handleTimeEntryChange(idx, 'night', e.target.value)}
                        className="w-full bg-transparent border-none p-2 focus:ring-0 text-xs text-center font-medium"
                      />
                    </td>
                    <td className="p-2 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => handleRemoveTimeEntry(idx)}
                        className="text-stone-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2 bg-stone-50/50 flex justify-center print:hidden">
              <button
                type="button"
                onClick={handleAddTimeEntry}
                className="text-xs font-bold text-emerald-700 flex items-center gap-1 hover:text-emerald-800"
              >
                <Plus size={14} />
                Adicionar Linha
              </button>
            </div>
          </div>

          {/* Serviços executados */}
          <div className="p-4 border-b border-stone-300">
            <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Serviços Executados</label>
            <textarea
              rows={8}
              value={formData.services_performed}
              onChange={e => setFormData({ ...formData, services_performed: e.target.value })}
              placeholder="Descreva detalhadamente todos os serviços realizados"
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300 resize-none leading-relaxed"
            />
          </div>

          {/* Observações */}
          <div className="p-4 border-b border-stone-300">
            <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Observações</label>
            <textarea
              rows={3}
              value={formData.observations}
              onChange={e => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Observações adicionais"
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium placeholder:text-stone-300 resize-none"
            />
          </div>

          {/* Assinatura */}
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="w-64 border-t border-stone-400 mt-8 mb-2" />
            <div className="text-[10px] font-bold text-stone-500 uppercase">Técnico Manutenção</div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.status === 'closed'}
            onChange={e => setFormData({ ...formData, status: e.target.checked ? 'closed' : 'open' })}
            className="rounded text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-stone-700">Finalizar Ordem de Serviço</span>
        </label>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-800 transition-colors shadow-lg disabled:opacity-50"
        >
          {saving
            ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            : <CheckCircle2 size={20} />
          }
          <span>{id && id !== 'new' ? 'Salvar Alterações' : 'Criar Ordem de Serviço'}</span>
        </button>
      </div>
    </div>
  );
}
