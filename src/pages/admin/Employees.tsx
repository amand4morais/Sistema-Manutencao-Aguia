import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserPlus, Search, Shield, User as UserIcon, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Profile } from '../../types';
import { validateCPF, formatCPF } from '../../utils/cpfValidator';
import toast from 'react-hot-toast';

const employeeSchema = z.object({
  cpf: z.string().refine((val) => validateCPF(val), { message: "CPF inválido" }),
  fullName: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  role: z.enum(['admin', 'employee']),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

export default function Employees() {
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
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (data: EmployeeForm) => {
    setLoading(true);
    try {
      const cleanCPF = data.cpf.replace(/\D/g, '');
      
      // Use provided email or fallback to an internal identifier
      // We use @af.internal to indicate it's a system-generated ID
      const authEmail = data.email && data.email.length > 0 
        ? data.email 
        : `${cleanCPF}@af.internal`;
      
      // Create a temporary client that doesn't persist session to avoid logging out the admin
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
          throw new Error('Limite de segurança do Supabase atingido. Por favor, aguarde alguns minutos ou use um e-mail real para o cadastro.');
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
          onClick={() => setIsModalOpen(true)}
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

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
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
            {filteredEmployees.map((employee) => (
              <tr key={employee.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500">
                      <UserIcon size={20} />
                    </div>
                    <span className="font-medium text-stone-900">{employee.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-stone-600">{employee.cpf}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit",
                    employee.role === 'admin' ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                  )}>
                    {employee.role === 'admin' ? <Shield size={12} /> : null}
                    {employee.role === 'admin' ? 'Administrador' : 'Manutentor'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {employee.must_change_password ? (
                    <span className="text-amber-600 text-xs flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                      Senha Pendente
                    </span>
                  ) : (
                    <span className="text-emerald-600 text-xs flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      Ativo
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-stone-400 hover:text-red-600 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Placeholder */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <h2 className="text-xl font-bold mb-6">Cadastrar Funcionário</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome Completo</label>
                <input {...register('fullName')} className="w-full px-4 py-2 border rounded-xl" />
                {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">E-mail (Opcional)</label>
                <input {...register('email')} placeholder="exemplo@email.com" className="w-full px-4 py-2 border rounded-xl" />
                {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CPF</label>
                <input 
                  {...register('cpf')} 
                  onChange={(e) => setValue('cpf', formatCPF(e.target.value))}
                  className="w-full px-4 py-2 border rounded-xl" 
                />
                {errors.cpf && <p className="text-red-500 text-xs">{errors.cpf.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cargo</label>
                <select {...register('role')} className="w-full px-4 py-2 border rounded-xl">
                  <option value="employee">Manutentor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border rounded-xl"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-emerald-700 text-white rounded-xl"
                >
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
