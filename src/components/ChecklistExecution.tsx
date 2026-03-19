import { useState, useEffect } from 'react';
import { XCircle, Save, Loader2, Check, X, Minus, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { ChecklistItem, ChecklistResponse } from '../types';
import { notifyAdmins } from '../utils/notificationUtils';
import toast from 'react-hot-toast';

interface ChecklistExecutionProps {
  maintenanceId: string;
  equipmentId: string;
  onClose: () => void;
}

interface GroupedItems {
  [position: string]: {
    [system: string]: (ChecklistItem & { response?: ChecklistResponse })[];
  };
}

export default function ChecklistExecution({ maintenanceId, equipmentId, onClose }: ChecklistExecutionProps) {
  const [groupedItems, setGroupedItems] = useState<GroupedItems>({});
  const [loading, setLoading] = useState(true);
  const [horimeterKm, setHorimeterKm] = useState('');
  const { addAction } = useOfflineSync();

  useEffect(() => {
    loadChecklistData();
  }, [maintenanceId, equipmentId]);

  async function loadChecklistData() {
    try {
      setLoading(true);
      
      // 1. Buscar a manutenção para pegar o horímetro atual
      const { data: maintenance, error: maintError } = await supabase
        .from('preventive_maintenances')
        .select('*') // Usar * para evitar erro se horimeter_km não existir
        .eq('id', maintenanceId)
        .single();
      
      if (maintError) throw maintError;

      if (maintenance && 'horimeter_km' in maintenance) {
        setHorimeterKm(maintenance.horimeter_km || '');
      } else if (maintenance?.general_observation?.includes('HORIMETRO:')) {
        // Fallback: tentar extrair do campo de observação
        const match = maintenance.general_observation.match(/HORIMETRO: (.*)/);
        if (match) setHorimeterKm(match[1]);
      }

      // 2. Buscar templates de itens para este equipamento
      // Tentar busca direta
      let { data: templates, error: templateError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('equipment_id', equipmentId);

      if (templateError && templateError.message.includes('equipment_id')) {
        // Tentar via checklists
        const { data: nested, error: nestedError } = await supabase
          .from('checklists')
          .select('*, checklist_items(*)')
          .eq('equipment_id', equipmentId);
        
        if (!nestedError) {
          templates = (nested || []).flatMap(c => c.checklist_items || []);
        }
      }

      if (!templates && templateError) throw templateError;

      // 3. Buscar respostas já salvas para esta manutenção
      const { data: responses, error: responseError } = await supabase
        .from('checklist_responses')
        .select('*')
        .eq('maintenance_id', maintenanceId);

      if (responseError) throw responseError;

      // 4. Agrupar itens
      const grouped: GroupedItems = {};
      (templates || []).forEach((item: any) => {
        // Fallback para quando as colunas novas não existem no DB
        let pos = item.position || 'Geral';
        let sys = item.system || 'Geral';
        let desc = item.description;

        // Se a descrição começa com [Posição | Sistema], extrair
        if (desc.startsWith('[')) {
          const match = desc.match(/^\[(.*?)\s*\|\s*(.*?)\]\s*(.*)/);
          if (match) {
            pos = match[1];
            sys = match[2];
            desc = match[3];
          }
        }
        
        if (!grouped[pos]) grouped[pos] = {};
        if (!grouped[pos][sys]) grouped[pos][sys] = [];
        
        const response = responses?.find(r => r.item_id === item.id);
        grouped[pos][sys].push({ ...item, position: pos, system: sys, description: desc, response });
      });

      // Ordenar por order_index se existir, senão por id
      for (const pos in grouped) {
        for (const sys in grouped[pos]) {
          grouped[pos][sys].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        }
      }

      setGroupedItems(grouped);
    } catch (error: any) {
      console.error('Erro ao carregar checklist:', error);
      toast.error('Erro ao carregar checklist: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateResponse = async (itemId: string, conformance: 'sim' | 'nao' | 'na', observation?: string) => {
    try {
      // Encontrar o item no estado para pegar a resposta atual
      let currentResponse: ChecklistResponse | undefined;
      for (const pos in groupedItems) {
        for (const sys in groupedItems[pos]) {
          const item = groupedItems[pos][sys].find(i => i.id === itemId);
          if (item) {
            currentResponse = item.response;
            break;
          }
        }
      }

      const payload: any = {
        maintenance_id: maintenanceId,
        item_id: itemId,
        conformance: conformance,
        observation: observation !== undefined ? observation : (currentResponse?.observation || null)
      };

      // Fallback para quando as colunas novas não existem no DB
      // Se 'conformance' não existir, podemos tentar usar 'checked' (boolean)
      // Mas aqui vamos apenas enviar e deixar o syncService lidar ou falhar graciosamente
      
      if (currentResponse?.id) {
        payload.id = currentResponse.id;
        await addAction('checklist_responses', 'UPDATE', payload);
      } else {
        await addAction('checklist_responses', 'INSERT', payload);
      }

      // Atualizar estado local
      setGroupedItems(prev => {
        const next = { ...prev };
        for (const pos in next) {
          for (const sys in next[pos]) {
            next[pos][sys] = next[pos][sys].map(i => {
              if (i.id === itemId) {
                return { ...i, response: { ...i.response, ...payload } as ChecklistResponse };
              }
              return i;
            });
          }
        }
        return next;
      });
    } catch (error) {
      toast.error('Erro ao salvar resposta');
    }
  };

  const handleSaveHorimeter = async () => {
    try {
      // Tentar salvar na coluna específica
      const { error } = await supabase
        .from('preventive_maintenances')
        .update({ horimeter_km: horimeterKm })
        .eq('id', maintenanceId);

      if (error) {
        // Fallback: salvar no campo de observação
        const { data: current } = await supabase
          .from('preventive_maintenances')
          .select('general_observation')
          .eq('id', maintenanceId)
          .single();
        
        const cleanObs = (current?.general_observation || '').replace(/HORIMETRO: .*/, '').trim();
        const newObs = `${cleanObs}\nHORIMETRO: ${horimeterKm}`.trim();
        
        await addAction('preventive_maintenances', 'UPDATE', {
          id: maintenanceId,
          general_observation: newObs
        });
      }
      
      toast.success('Horímetro/Km salvo');
    } catch (error) {
      toast.error('Erro ao salvar horímetro');
    }
  };

  const isAllAnswered = () => {
    for (const pos in groupedItems) {
      for (const sys in groupedItems[pos]) {
        if (groupedItems[pos][sys].some(i => !i.response?.conformance)) return false;
      }
    }
    return true;
  };

  const handleFinish = async () => {
    if (!isAllAnswered()) {
      toast.error('Responda todos os itens antes de finalizar');
      return;
    }
    
    // Notificar admins sobre checklist concluído
    await notifyAdmins(
      'Checklist Concluído',
      `Checklist da manutenção foi finalizado.`,
      'success',
      '/maintenance'
    );
    
    toast.success('Checklist finalizado com sucesso!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-md">
      <div className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-white/20">
        {/* Header */}
        <div className="p-6 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold">Checklist de Manutenção</h2>
            <p className="text-stone-400 text-sm">Preencha todos os pontos de inspeção</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <XCircle size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-stone-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="animate-spin text-emerald-600" size={48} />
              <p className="text-stone-500 animate-pulse">Carregando checklist...</p>
            </div>
          ) : (
            <>
              {/* Horímetro / KM Section */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row items-end gap-4">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wider">Horímetro / KM Atual</label>
                  <input 
                    type="text"
                    value={horimeterKm}
                    onChange={(e) => setHorimeterKm(e.target.value)}
                    placeholder="Ex: 125400"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-lg"
                  />
                </div>
                <button 
                  onClick={handleSaveHorimeter}
                  className="bg-stone-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center gap-2 shrink-0 shadow-lg active:scale-95"
                >
                  <Save size={20} />
                  Salvar
                </button>
              </div>

              {/* Checklist Items */}
              {Object.keys(groupedItems).length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-stone-200">
                  <p className="text-stone-400 italic">Nenhum item de checklist configurado para este equipamento.</p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([pos, systems]) => (
                  <div key={pos} className="space-y-4">
                    <h3 className="text-lg font-black text-stone-900 uppercase tracking-tighter border-l-4 border-emerald-600 pl-3">{pos}</h3>
                    
                    {Object.entries(systems).map(([sys, items]) => (
                      <div key={sys} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                        <div className="bg-stone-100 px-4 py-2 border-b border-stone-200">
                          <span className="text-xs font-bold text-stone-500 uppercase">{sys}</span>
                        </div>
                        
                        <div className="divide-y divide-stone-100">
                          {items.map((item) => (
                            <div key={item.id} className="p-4 space-y-3 hover:bg-stone-50/50 transition-colors">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <span className="text-stone-800 font-medium flex-1">{item.description}</span>
                                
                                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 shrink-0">
                                  <button
                                    onClick={() => handleUpdateResponse(item.id, 'sim')}
                                    className={`flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                      item.response?.conformance === 'sim'
                                      ? 'bg-emerald-600 text-white shadow-md'
                                      : 'text-stone-500 hover:bg-white'
                                    }`}
                                  >
                                    <Check size={14} /> SIM
                                  </button>
                                  <button
                                    onClick={() => handleUpdateResponse(item.id, 'nao')}
                                    className={`flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                      item.response?.conformance === 'nao'
                                      ? 'bg-red-600 text-white shadow-md'
                                      : 'text-stone-500 hover:bg-white'
                                    }`}
                                  >
                                    <X size={14} /> NÃO
                                  </button>
                                  <button
                                    onClick={() => handleUpdateResponse(item.id, 'na')}
                                    className={`flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                      item.response?.conformance === 'na'
                                      ? 'bg-stone-400 text-white shadow-md'
                                      : 'text-stone-500 hover:bg-white'
                                    }`}
                                  >
                                    <Minus size={14} /> N/A
                                  </button>
                                </div>
                              </div>

                              <div className="relative">
                                <MessageSquare className="absolute left-3 top-3 text-stone-300" size={16} />
                                <input 
                                  type="text"
                                  placeholder="Observação individual..."
                                  value={item.response?.observation || ''}
                                  onChange={(e) => handleUpdateResponse(item.id, item.response?.conformance || 'sim', e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-stone-100 flex gap-4 shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 py-4 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-all active:scale-95"
          >
            Fechar
          </button>
          <button 
            onClick={handleFinish}
            disabled={!isAllAnswered()}
            className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
              isAllAnswered() 
              ? 'bg-emerald-700 text-white hover:bg-emerald-800' 
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Finalizar Checklist
          </button>
        </div>
      </div>
    </div>
  );
}
