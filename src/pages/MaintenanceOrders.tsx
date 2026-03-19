import { useState, useEffect } from 'react';
import { Search, Plus, FileText, ChevronRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MaintenanceOrder, Equipment } from '../types';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MaintenanceOrders() {
  const [orders, setOrders] = useState<(MaintenanceOrder & { equipment?: Equipment })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile } = useAuth();

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('maintenance_orders')
        .select('*, equipment:equipments(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar OS:', error);
      toast.error('Erro ao carregar Ordens de Serviço');
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter(o => 
    o.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.equipment?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.requester_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Ordens de Serviço</h1>
          <p className="text-stone-500">Gerencie as Ordens de Serviço de Manutenção (OS)</p>
        </div>
        
        <Link 
          to="/maintenance-orders/new"
          className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-800 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Nova OS</span>
        </Link>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por número, equipamento ou solicitante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => (
            <Link 
              key={order.id}
              to={`/maintenance-orders/${order.id}`}
              className="bg-white p-6 rounded-2xl border border-stone-200 hover:border-emerald-200 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${order.status === 'closed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <FileText size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-stone-900">OS #{order.number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      order.status === 'closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {order.status === 'closed' ? 'Finalizada' : 'Aberta'}
                    </span>
                  </div>
                  <p className="text-stone-600 font-medium">{order.equipment?.name || 'Equipamento não identificado'}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                    <span>Solicitante: {order.requester_name}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-stone-700">{order.establishment}</p>
                  <p className="text-xs text-stone-400">{order.cost_center_name}</p>
                </div>
                <ChevronRight className="text-stone-300" size={20} />
              </div>
            </Link>
          ))}

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-stone-300">
              <p className="text-stone-500">Nenhuma Ordem de Serviço encontrada.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
