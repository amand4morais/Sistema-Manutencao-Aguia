import { useState, useEffect } from 'react';
import { Search, Plus, FileText, Pencil, Settings, Trash2, X, Upload, Loader2, ClipboardCheck, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Equipment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import ChecklistManager from '../components/ChecklistManager';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

import { getMaintenanceSchedule } from '../utils/maintenanceUtils';

export default function Equipments() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [checklistEquipmentId, setChecklistEquipmentId] = useState<string | null>(null);

  const { profile } = useAuth();
  const { addAction } = useOfflineSync();

  const [formData, setFormData] = useState({
    name: '',
    model: '',
    serial_number: '',
    description: '',
    preventive_interval_days: 30,
    manual_url: ''
  });

  useEffect(() => {
    fetchEquipments();
  }, []);

  async function fetchEquipments() {
    try {
      const [
        { data: eqData, error: eqError },
        scheduleData
      ] = await Promise.all([
        supabase.from('equipments').select('*').order('name'),
        getMaintenanceSchedule()
      ]);

      if (eqError) throw eqError;
      setEquipments(eqData || []);
      setSchedule(scheduleData);
    } catch (error: any) {
      toast.error('Erro ao carregar equipamentos');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (equipment?: Equipment) => {
    if (equipment) {
      setEditingEquipment(equipment);
      setFormData({
        name: equipment.name,
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        description: equipment.description || '',
        preventive_interval_days: equipment.preventive_interval_days,
        manual_url: equipment.manual_url || ''
      });
    } else {
      setEditingEquipment(null);
      setFormData({
        name: '',
        model: '',
        serial_number: '',
        description: '',
        preventive_interval_days: 30,
        manual_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `manuals/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('manuals')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('manuals')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, manual_url: publicUrl }));
      toast.success('Manual carregado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao carregar arquivo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      version: editingEquipment ? (editingEquipment.version ?? 1) : 1
    };

    try {
      if (editingEquipment) {
        await addAction('equipments', 'UPDATE', { ...payload, id: editingEquipment.id });
        toast.success('Equipamento atualizado!');
      } else {
        await addAction('equipments', 'INSERT', payload);
        toast.success('Equipamento cadastrado!');
      }

      setIsModalOpen(false);
      fetchEquipments();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o equipamento "${name}"?`)) return;

    try {
      await addAction('equipments', 'DELETE', { id });
      toast.success('Equipamento excluído!');
      fetchEquipments();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredEquipments = equipments.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Equipamentos</h1>
          <p className="text-stone-500">Visualize e gerencie os equipamentos da frota</p>
        </div>

        {profile?.role === 'admin' && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-800 transition-colors"
          >
            <Plus size={20} />
            <span>Novo Equipamento</span>
          </button>
        )}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por nome ou número de série..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEquipments.map((equipment) => {
            const eqSchedule = schedule.find(s => s.equipmentId === equipment.id);
            const isOverdue = eqSchedule && eqSchedule.daysRemaining < 0;
            const isSoon = eqSchedule && eqSchedule.daysRemaining >= 0 && eqSchedule.daysRemaining <= 7;

            return (
              <div
                key={equipment.id}
                className="bg-white p-6 rounded-2xl border border-stone-200 hover:border-emerald-200 hover:shadow-lg transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-emerald-50 p-3 rounded-xl text-emerald-700">
                    <Settings size={24} />
                  </div>

                  {profile?.role === 'admin' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenModal(equipment)}
                        title="Editar equipamento"
                        className="text-stone-400 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(equipment.id, equipment.name)}
                        title="Excluir equipamento"
                        className="text-stone-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-lg text-stone-900 mb-1">{equipment.name}</h3>
                <p className="text-stone-500 text-sm mb-1">
                  {equipment.model && <span>{equipment.model} · </span>}
                  S/N: {equipment.serial_number || 'N/A'}
                </p>

                {eqSchedule && (
                  <div className="mt-3 mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1">
                      <Clock
                        size={11}
                        className={isOverdue ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-emerald-600'}
                      />
                      <span className={isOverdue ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-emerald-600'}>
                        Próxima Revisão
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${isOverdue ? 'text-red-600' : 'text-stone-900'}`}>
                      {format(eqSchedule.nextDate, 'dd/MM/yyyy')}
                      <span className="text-xs font-normal text-stone-400 ml-2">
                        {isOverdue
                          ? `(${Math.abs(eqSchedule.daysRemaining)}d atraso)`
                          : `(${eqSchedule.daysRemaining}d restantes)`}
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-4 border-t border-stone-100">
                  {equipment.manual_url ? (
                    <a
                      href={equipment.manual_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-emerald-700 font-medium text-sm hover:underline"
                    >
                      <FileText size={15} />
                      Ver Manual
                    </a>
                  ) : (
                    <span className="text-stone-400 text-sm italic">Sem manual</span>
                  )}

                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => setChecklistEquipmentId(equipment.id)}
                      className="flex items-center gap-1.5 text-stone-500 font-medium text-sm hover:text-emerald-700 transition-colors ml-auto"
                    >
                      <ClipboardCheck size={15} />
                      Checklist
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredEquipments.length === 0 && !loading && (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-stone-300">
              <Settings size={40} className="mx-auto text-stone-200 mb-3" />
              <p className="text-stone-500 font-medium">Nenhum equipamento encontrado.</p>
              {profile?.role === 'admin' && !searchTerm && (
                <button
                  onClick={() => handleOpenModal()}
                  className="mt-3 text-emerald-700 text-sm font-medium hover:underline"
                >
                  Cadastrar primeiro equipamento
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Gerenciador de Checklist */}
      {checklistEquipmentId && (
        <ChecklistManager
          equipmentId={checklistEquipmentId}
          onClose={() => setChecklistEquipmentId(null)}
        />
      )}

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-stone-900">
                {editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Nome do Equipamento *
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Modelo</label>
                  <input
                    value={formData.model}
                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nº de Série</label>
                  <input
                    value={formData.serial_number}
                    onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Intervalo Preventivo (dias) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.preventive_interval_days}
                    onChange={e => setFormData({ ...formData, preventive_interval_days: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">Manual (PDF)</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all">
                      {uploading
                        ? <Loader2 className="animate-spin text-stone-400" size={18} />
                        : <Upload size={18} className="text-stone-400" />
                      }
                      <span className="text-sm font-medium text-stone-600">
                        {formData.manual_url ? 'Substituir PDF' : 'Carregar PDF'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                    {formData.manual_url && (
                      <a
                        href={formData.manual_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-800 transition-colors"
                        title="Visualizar manual atual"
                      >
                        <FileText size={22} />
                      </a>
                    )}
                  </div>
                </div>
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
                  disabled={uploading}
                  className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {editingEquipment ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
