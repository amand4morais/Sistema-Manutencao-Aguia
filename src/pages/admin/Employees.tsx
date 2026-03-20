import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserPlus, Search, Shield, User as UserIcon, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Profile } from '../../types';
import { validateCPF, formatCPF } from '../../utils/cpfValidator';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const employeeSchema = z.object({
  cpf: z.string().refine((val) => validateCPF(val), { message: 'CPF inválido' }),
  fullName: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  role: z.enum(['admin', 'employee']),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

function cn(...inputs: (string | false | undefined | null)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function Employees() {
  const { profile: currentProfile } = useAuth();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { role: 'employee', email: '' }
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true }); // ASC para o primeiro ser o Master

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  }

  // Admin Master = primeiro admin cadastrado (created_at mais antigo)
  // Mesma lógica usada na política RLS do banco
  const adminMasterId = employees
    .filter(e => e.role === 'admin')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]?.id;

  const onSubmit = async (data: EmployeeForm) => {
    setLoading(true);
    try {
      const cleanCPF = data.cpf.replace(/\D/g, '');
      const authEmail = data.email && data.email.length > 0
        ? data.email
        : `${cleanCPF}@af.internal`;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      });

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: authEmail,
        password: 'af' + cleanCPF.substring(0, 4),
      });

      if (authError) {
        if (authError.message.includes('rate limit')) {
          throw new Error('Limite de segurança atingido. Aguarde alguns minutos ou use um e-mail real.');
        }
        throw authError;
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            cpf: data.cpf,
            full_name: data.fullName,
            email: data.email || null,
            role: data.role,
            must_change_password: true
          });

        if (profileError) throw profileError;
      }

      toast.success('Funcionário cadastrado com sucesso!');
      setIsModalOpen(false);
      reset();
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cadastrar funcionário');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (employee: Profile) => {
    // Proteção frontend 1: não pode excluir a si mesmo
    if (employee.id === currentProfile?.id) {
      toast.error('Você não pode excluir sua própria conta.');
      return;
    }

    // Proteção frontend 2: Admin Master não pode ser excluído
    if (employee.id === adminMasterId) {
      toast.error('O Administrador Master não pode ser excluído.');
      return;
    }

    if (!confirm(`Excluir o funcionário "${employee.full_name}"?\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', employee.id);

      if (error) {
        // Proteção backend: RLS bloqueou — tratar com mensagem clara
        if (
          error.code === '42501' ||
          error.code === 'PGRST301' ||
          error.message?.includes('row-level security') ||
          error.message?.includes('permission')
        ) {
          toast.error('Operação negada pelo servidor. Verifique suas permissões.');
          return;
        }
        throw error;
      }

      toast.success(`Funcionário "${employee.full_name}" removido com sucesso.`);
      fetchEmployees();
    } catch (error: any) {
      console.error('Erro ao excluir funcionário:', error);
      toast.error('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cpf.includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Gestão de Funcionários</h1>
          <p className="text-stone-500">Cadastre e gerencie os colaboradores da Águia Florestal</p>
        </div>

        <button
          onClick={() => { reset(); setIsModalOpen(true); }}
          className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-800 transition-colors"
        >
          <UserPlus size={20} />
          <span>Novo Funcionário</span>
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700" />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-6 py-4 text-sm font-semibold text-stone-600">Funcionário</th>
                <th className="px-6 py-4 text-sm font-semibold text-stone-600">CPF</th>
                <th className="px-6 py-4 text-sm font-semibold text-stone-600">Cargo</th>
                <th className="px-6 py-4 text-sm font-semibold text-stone-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-stone-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-stone-400 italic">
                    Nenhum funcionário encontrado.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => {
                  const isSelf    = employee.id === currentProfile?.id;
                  const isMaster  = employee.id === adminMasterId;
                  const canDelete = !isSelf && !isMaster;

                  return (
                    <tr key={employee.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                            <UserIcon size={18} />
                          </div>
                          <div>
                            <span className="font-medium text-stone-900 block leading-tight">
                              {employee.full_name}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                                Você
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-stone-500 text-sm font-mono">
                        {employee.cpf}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit',
                            employee.role === 'admin'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-blue-50 text-blue-700'
                          )}>
                            {employee.role === 'admin' && <Shield size={11} />}
                            {employee.role === 'admin' ? 'Administrador' : 'Manutentor'}
                          </span>
                          {isMaster && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                              Master
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {employee.must_change_password ? (
                          <span className="text-amber-600 text-xs flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Senha Pendente
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-xs flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {canDelete ? (
                          <button
                            onClick={() => handleDelete(employee)}
                            title={`Excluir ${employee.full_name}`}
                            className="text-stone-300 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={17} />
                          </button>
                        ) : (
                          <span
                            title={
                              isMaster
                                ? 'Admin Master não pode ser excluído'
                                : 'Não é possível excluir sua própria conta'
                            }
                            className="text-stone-200 p-1.5 inline-block cursor-not-allowed"
                          >
                            <Trash2 size={17} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Cadastrar Funcionário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-stone-900">Cadastrar Funcionário</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nome Completo *</label>
                <input
                  {...register('fullName')}
                  placeholder="Nome do funcionário"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.fullName && (
                  <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">CPF *</label>
                <input
                  {...register('cpf')}
                  placeholder="000.000.000-00"
                  onChange={(e) => setValue('cpf', formatCPF(e.target.value))}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
                {errors.cpf && (
                  <p className="text-red-500 text-xs mt-1">{errors.cpf.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  E-mail <span className="text-stone-400 font-normal">(opcional)</span>
                </label>
                <input
                  {...register('email')}
                  placeholder="exemplo@email.com"
                  type="email"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Cargo *</label>
                <select
                  {...register('role')}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="employee">Manutentor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <p className="text-xs text-stone-400 bg-stone-50 rounded-xl p-3 leading-relaxed">
                A senha inicial será <strong className="text-stone-600 font-mono">af</strong> seguida
                dos primeiros 4 dígitos do CPF. O funcionário deverá alterá-la no primeiro acesso.
              </p>

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
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Cadastrando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
