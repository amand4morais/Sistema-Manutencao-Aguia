import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateCPF, formatCPF } from '../utils/cpfValidator';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const loginSchema = z.object({
  cpf: z.string().refine((val) => validateCPF(val), {
    message: "CPF inválido",
  }),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const cleanCPF = data.cpf.replace(/\D/g, '');
      // We use @af.internal as the default system identifier for CPF-based login
      const email = `${cleanCPF}@af.internal`;
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          throw new Error('E-mail não confirmado. Por favor, solicite ao administrador que confirme sua conta no painel do Supabase.');
        }
        
        // If login fails with the new format, try the old format for backward compatibility
        const oldEmail = `${cleanCPF}@aguiaflorestal.com.br`;
        const { error: oldError } = await supabase.auth.signInWithPassword({
          email: oldEmail,
          password: data.password,
        });

        if (oldError) {
          if (oldError.message.includes('Invalid login credentials')) {
            throw new Error('CPF ou senha incorretos.');
          }
          if (oldError.message.includes('Email not confirmed')) {
            throw new Error('E-mail não confirmado. Por favor, solicite ao administrador que confirme sua conta no painel do Supabase.');
          }
          throw oldError;
        }
      }
      
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setValue('cpf', formatted);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Image with Greenish Filter */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center scale-105"
        style={{ 
          backgroundImage: 'url("https://aguiaflorestal.ind.br/wp-content/uploads/2025/07/Fabrica-4-scaled.jpg")',
        }}
      />
      <div className="absolute inset-0 z-10 bg-emerald-950/50 backdrop-brightness-75" />

      {/* Login Card with Glassmorphism */}
      <div className="relative z-20 w-full max-w-md bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
        <div className="text-center mb-8">
          <img 
            src="https://aguiaflorestal.ind.br/wp-content/uploads/2022/08/AguiaFlorestal_Site_Home-1_54.png" 
            alt="Águia Florestal" 
            className="h-20 mx-auto mb-4 drop-shadow-lg object-contain"
            referrerPolicy="no-referrer"
          />
          <p className="text-emerald-50/80 font-medium">Sistema de Manutenção</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-emerald-50 mb-1">CPF</label>
            <input
              {...register('cpf')}
              onChange={handleCPFChange}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
            />
            {errors.cpf && <p className="text-red-300 text-xs mt-1">{errors.cpf.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-50 mb-1">Senha</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && <p className="text-red-300 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : (
              <>
                <LogIn size={22} />
                <span>Entrar no Sistema</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
