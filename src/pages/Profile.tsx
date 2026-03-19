import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Mail, Shield, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  fullName: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (profile) {
      reset({
        fullName: profile.full_name,
        email: profile.email || '',
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: ProfileForm) => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          email: data.email || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900">Meu Perfil</h1>
        <p className="text-stone-500">Gerencie suas informações pessoais</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <User size={40} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">{profile.full_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1">
                  {profile.role === 'admin' ? <Shield size={12} /> : null}
                  {profile.role === 'admin' ? 'Administrador' : 'Manutentor'}
                </span>
                <span className="text-stone-400 text-xs">•</span>
                <span className="text-stone-500 text-xs">CPF: {profile.cpf}</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1 flex items-center gap-2">
                <User size={16} className="text-stone-400" />
                Nome Completo
              </label>
              <input
                {...register('fullName')}
                className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1 flex items-center gap-2">
                <Mail size={16} className="text-stone-400" />
                E-mail
              </label>
              <input
                {...register('email')}
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
              <p className="text-xs text-stone-400 mt-1">
                Este e-mail será usado para comunicações do sistema.
              </p>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-emerald-700 text-white font-semibold rounded-xl hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                'Salvando...'
              ) : (
                <>
                  <Save size={20} />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
