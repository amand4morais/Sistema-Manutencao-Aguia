import { useState, useEffect, useCallback } from 'react';
import { XCircle, Save, Loader2, Check, X, Minus, ChevronDown, ChevronUp } from 'lucide-react';
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

interface ItemWithResponse extends ChecklistItem {
  response?: Partial<ChecklistResponse>;
}

// Debounce simples para evitar gravar a cada tecla na observação
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Sub-componente de item individual para isolar o estado da observação
function ChecklistRow({
  item,
  index,
  onConformanceChange,
  onObservationChange,
}: {
  item: ItemWithResponse;
  index: number;
  onConformanceChange: (itemId: string, value: 'sim' | 'nao' | 'na') => void;
  onObservationChange: (itemId: string, value: string) => void;
}) {
  // Estado local da observação para não disparar save a cada tecla
  const [obs, setObs] = useState(item.response?.observation || '');
  const debouncedObs = useDebounce(obs, 600);

  // Sincroniza quando o item é carregado/atualizado externamente
  useEffect(() => {
    setObs(item.response?.observation || '');
  }, [item.id]);

  // Dispara save apenas quando o debounce estabilizar
  useEffect(() => {
    const saved = item.response?.observation || '';
    if (debouncedObs !== saved) {
      onObservationChange(item.id, debouncedObs);
    }
  }, [debouncedObs]);

  const conformance = item.response?.conformance;
  const isAnswered = !!conformance;

  return (
    <div
      className={`flex flex-col gap-3 p-4 border-b border-stone-100 last:border-0 transition-colors ${
        isAnswered ? 'bg-white' : 'bg-amber-50/40'
      }`}
    >
      {/* Linha principal: número + descrição + botões */}
      <div className="flex items-start gap-3">
        {/* Número do item */}
        <span className="text-xs font-bold text-stone-400 w-6 shrink-0 mt-0.5 text-right">
          {index + 1}
        </span>

        {/* Descrição */}
        <p className="flex-1 text-sm text-stone-800 leading-snug">{item.description}</p>

        {/* Botões de conformidade */}
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onConformanceChange(item.id, 'sim')}
            title="Conforme"
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all active:scale-95 ${
              conformance === 'sim'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-stone-100 text-stone-400 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => onConformanceChange(item.id, 'nao')}
            title="Não conforme"
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all active:scale-95 ${
              conformance === 'nao'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-stone-100 text-stone-400 hover:bg-red-50 hover:text-red-700'
            }`}
          >
            <X size={16} />
          </button>
          <button
            onClick={() => onConformanceChange(item.id, 'na')}
            title="Não aplicável"
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all active:scale-95 ${
              conformance === 'na'
                ? 'bg-stone-500 text-white shadow-md'
                : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
            }`}
          >
            <Minus size={16} />
          </button>
        </div>
      </div>

      {/* Campo de observação — sempre visível, mas discreto */}
      <div className="ml-9">
        <input
          type="text"
          placeholder="Observação (opcional)..."
          value={obs}
          onChange={e => setObs(e.target.value)}
          className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${
            conformance === 'nao'
              ? 'border-red-200 bg-red-50/50 focus:ring-1 focus:ring-red-300 placeholder:text-red-300'
              : 'border-stone-200 bg-stone-50 focus:ring-1 focus:ring-emerald-400 placeholder:text-stone-300'
          }`}
        />
      </div>
    </div>
  );
}

export default function ChecklistExecution({ maintenanceId, equipmentId, onClose }: ChecklistExecutionProps) {
  const [items, setItems] = useState<ItemWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [horimeterKm, setHorimeterKm] = useState('');
  const [savingHorimeter, setSavingHorimeter] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const { addAction } = useOfflineSync();

  useEffect(() => {
    loadChecklistData();
  }, [maintenanceId, equipmentId]);

  async function loadChecklistData() {
    try {
      setLoading(true);

      // 1. Buscar horímetro da manutenção
      const { data: maintenance } = await supabase
        .from('preventive_maintenances')
        .select('general_observation, horimeter_km')
        .eq('id', maintenanceId)
        .single();

      if (maintenance) {
        const hk = (maintenance as any).horimeter_km;
        if (hk) {
          setHorimeterKm(hk);
        } else if (maintenance.general_observation?.includes('HORIMETRO:')) {
          const match = maintenance.general_observation.match(/HORIMETRO:\s*(.*)/);
          if (match) setHorimeterKm(match[1].trim());
        }
      }

      // 2. Buscar itens do checklist para o equipamento
      let templateItems: any[] = [];

      // Tentativa 1: direto por equipment_id
      const { data: direct, error: directError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('order_index', { ascending: true });

      if (!directError && direct && direct.length > 0) {
        templateItems = direct;
      } else {
        // Tentativa 2: via tabela checklists (estrutura do README)
        const { data: nested } = await supabase
          .from('checklists')
          .select('*, checklist_items(*)')
          .eq('equipment_id', equipmentId);

        if (nested) {
          templateItems = nested.flatMap((c: any) => c.checklist_items || []);
        }
      }

      // 3. Buscar respostas já salvas
      const { data: responses } = await supabase
        .from('checklist_responses')
        .select('*')
        .eq('maintenance_id', maintenanceId);

      const responsesMap: Record<string, Partial<ChecklistResponse>> = {};
      (responses || []).forEach((r: any) => {
        responsesMap[r.item_id] = r;
      });

      // 4. Normalizar descrição — remover prefixo [Pos | Sys] se existir
      const normalized: ItemWithResponse[] = templateItems.map((item: any) => {
        let description = item.description || '';
        if (description.startsWith('[')) {
          const match = description.match(/^\[.*?\]\s*(.*)/);
          if (match) description = match[1];
        }
        return {
          ...item,
          description,
          response: responsesMap[item.id]
        };
      });

      setItems(normalized);
    } catch (error: any) {
      console.error('Erro ao carregar checklist:', error);
      toast.error('Erro ao carregar checklist: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  // Salvar conformidade (chamado ao clicar em SIM/NÃO/NA)
  const handleConformanceChange = useCallback(async (itemId: string, conformance: 'sim' | 'nao' | 'na') => {
    setItems(prev => prev.map(i =>
      i.id === itemId
        ? { ...i, response: { ...i.response, conformance } }
        : i
    ));

    const item = items.find(i => i.id === itemId);
    const current = item?.response;

    const payload: any = {
      maintenance_id: maintenanceId,
      item_id: itemId,
      conformance,
      observation: current?.observation || null
    };

    if (current?.id) {
      payload.id = current.id;
      await addAction('checklist_responses', 'UPDATE', payload);
    } else {
      await addAction('checklist_responses', 'INSERT', payload);
    }
  }, [items, maintenanceId, addAction]);

  // Salvar observação (chamado pelo debounce do ChecklistRow)
  const handleObservationChange = useCallback(async (itemId: string, observation: string) => {
    setItems(prev => prev.map(i =>
      i.id === itemId
        ? { ...i, response: { ...i.response, observation } }
        : i
    ));

    const item = items.find(i => i.id === itemId);
    const current = item?.response;

    const payload: any = {
      maintenance_id: maintenanceId,
      item_id: itemId,
      conformance: current?.conformance || null,
      observation
    };

    if (current?.id) {
      payload.id = current.id;
      await addAction('checklist_responses', 'UPDATE', payload);
    } else if (current?.conformance) {
      // Só insere se já tiver conformância definida
      await addAction('checklist_responses', 'INSERT', payload);
    }
  }, [items, maintenanceId, addAction]);

  const handleSaveHorimeter = async () => {
    setSavingHorimeter(true);
    try {
      const { error } = await supabase
        .from('preventive_maintenances')
        .update({ horimeter_km: horimeterKm })
        .eq('id', maintenanceId);

      if (error) {
        // Fallback: salvar em general_observation
        const { data: current } = await supabase
          .from('preventive_maintenances')
          .select('general_observation')
          .eq('id', maintenanceId)
          .single();

        const cleanObs = (current?.general_observation || '').replace(/HORIMETRO:.*/, '').trim();
        await addAction('preventive_maintenances', 'UPDATE', {
          id: maintenanceId,
          general_observation: `${cleanObs}\nHORIMETRO: ${horimeterKm}`.trim()
        });
      }
      toast.success('Horímetro/Km salvo');
    } catch {
      toast.error('Erro ao salvar horímetro');
    } finally {
      setSavingHorimeter(false);
    }
  };

  const answeredCount = items.filter(i => !!i.response?.conformance).length;
  const totalCount = items.length;
  const allAnswered = answeredCount === totalCount && totalCount > 0;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const handleFinish = async () => {
    if (!allAnswered) {
      toast.error(`Responda todos os itens antes de finalizar (${answeredCount}/${totalCount})`);
      return;
    }

    setFinishing(true);
    try {
      await notifyAdmins(
        'Checklist Concluído',
        `Checklist da manutenção ${maintenanceId} foi finalizado.`,
        'success',
        '/maintenance'
      );
      toast.success('Checklist finalizado com sucesso!');
      onClose();
    } catch {
      toast.error('Erro ao finalizar checklist');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-3xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold">Checklist de Manutenção</h2>
            <p className="text-stone-400 text-xs mt-0.5">
              {loading ? 'Carregando...' : `${answeredCount} de ${totalCount} itens respondidos`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Barra de progresso */}
        {!loading && totalCount > 0 && (
          <div className="shrink-0 bg-stone-800 px-5 pb-3">
            <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
              <span>Progresso</span>
              <span className="font-bold text-white">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto bg-stone-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={36} />
              <p className="text-stone-400 text-sm">Carregando checklist...</p>
            </div>
          ) : (
            <>
              {/* Campo Horímetro */}
              <div className="p-4 bg-white border-b border-stone-200">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  Horímetro / KM Atual
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={horimeterKm}
                    onChange={e => setHorimeterKm(e.target.value)}
                    placeholder="Ex: 125400"
                    className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-base"
                  />
                  <button
                    onClick={handleSaveHorimeter}
                    disabled={savingHorimeter || !horimeterKm.trim()}
                    className="bg-stone-800 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-stone-700 transition-all flex items-center gap-2 disabled:opacity-40 active:scale-95"
                  >
                    {savingHorimeter
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Save size={16} />
                    }
                    Salvar
                  </button>
                </div>
              </div>

              {/* Lista de itens */}
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                  <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
                    <Check size={28} className="text-stone-300" />
                  </div>
                  <p className="text-stone-500 font-medium">Nenhum item configurado</p>
                  <p className="text-stone-400 text-sm mt-1">
                    Configure o checklist deste equipamento na tela de Equipamentos.
                  </p>
                </div>
              ) : (
                <div className="bg-white m-4 rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                  {/* Legenda dos botões */}
                  <div className="flex items-center justify-end gap-4 px-4 py-2 bg-stone-50 border-b border-stone-100">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      Conformidade:
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                      <Check size={10} /> OK
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                      <X size={10} /> Falha
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-stone-500">
                      <Minus size={10} /> N/A
                    </span>
                  </div>

                  {/* Itens */}
                  {items.map((item, index) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      index={index}
                      onConformanceChange={handleConformanceChange}
                      onObservationChange={handleObservationChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-stone-100 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-all active:scale-95 text-sm"
          >
            Fechar
          </button>
          <button
            onClick={handleFinish}
            disabled={!allAnswered || finishing}
            className={`flex-1 py-3 rounded-2xl font-bold transition-all text-sm active:scale-95 ${
              allAnswered
                ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-lg'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }`}
          >
            {finishing
              ? 'Finalizando...'
              : allAnswered
                ? `Finalizar Checklist ✓`
                : `Finalizar (${answeredCount}/${totalCount})`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
