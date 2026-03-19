import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ChecklistItem } from '../types';
import toast from 'react-hot-toast';

interface ChecklistManagerProps {
  equipmentId: string;
  onClose: () => void;
}

export default function ChecklistManager({ equipmentId, onClose }: ChecklistManagerProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    fetchItems();
  }, [equipmentId]);

  async function fetchItems() {
    try {
      // 1. Tentar busca direta (Simplificada)
      const { data: directData, error: directError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('equipment_id', equipmentId);

      if (!directError) {
        const filtered = (directData || []).filter((item: any) => !item.maintenance_id);
        setItems(filtered);
        return;
      }

      // 2. Se falhar, tentar via tabela intermediária 'checklists'
      const { data: nestedData, error: nestedError } = await supabase
        .from('checklists')
        .select('*, checklist_items(*)')
        .eq('equipment_id', equipmentId);

      if (nestedError) throw nestedError;

      // Achatar os itens de todos os checklists do equipamento
      const allItems = (nestedData || []).flatMap(c => c.checklist_items || []);
      setItems(allItems);
    } catch (error: any) {
      console.error('Erro ao carregar checklist:', error);
      toast.error('Erro ao carregar checklist');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;

    try {
      // 1. Tentar inserção direta
      const { error: directError } = await supabase
        .from('checklist_items')
        .insert({
          equipment_id: equipmentId,
          description: newItem,
          position: 'Geral',
          system: 'Geral',
          order_index: items.length
        });

      if (directError && directError.message.includes('equipment_id')) {
        // 2. Tentar via tabela intermediária
        let { data: checklist } = await supabase
          .from('checklists')
          .select('id')
          .eq('equipment_id', equipmentId)
          .limit(1)
          .single();

        if (!checklist) {
          const { data: newC } = await supabase
            .from('checklists')
            .insert({ equipment_id: equipmentId, name: 'Checklist Geral' })
            .select()
            .single();
          checklist = newC;
        }

        if (checklist) {
          await supabase.from('checklist_items').insert({
            checklist_id: checklist.id,
            description: newItem
          });
        }
      } else if (directError) {
        // Outro erro, tentar modo compatibilidade
        await supabase.from('checklist_items').insert({
          equipment_id: equipmentId,
          description: newItem
        });
      }

      setNewItem('');
      fetchItems();
      toast.success('Item adicionado');
    } catch (error: any) {
      console.error('Erro ao adicionar item:', error);
      toast.error('Erro ao adicionar item');
    }
  }

  async function handleDeleteItem(id: string) {
    try {
      const { error } = await supabase
        .from('checklist_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchItems();
      toast.success('Item removido');
    } catch (error: any) {
      toast.error('Erro ao remover item');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-stone-900">Configurar Checklist</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Ex: Verificar nível do óleo"
            className="flex-1 px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <button 
            type="submit"
            className="bg-emerald-700 text-white p-2 rounded-xl hover:bg-emerald-800 transition-colors"
          >
            <Plus size={24} />
          </button>
        </form>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {loading ? (
            <div className="text-center py-4 text-stone-400">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-stone-400 italic">
              Nenhum item configurado para este equipamento.
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-stone-700 text-sm">{item.description}</span>
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-stone-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-stone-100">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
