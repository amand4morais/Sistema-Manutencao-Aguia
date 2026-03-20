import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, LogIn, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateCPF, formatCPF } from '../utils/cpfValidator';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const loginSchema = z.object({
  cpf: z.string().refine((val) => validateCPF(val), {
    message: 'CPF inválido',
  }),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [isOnline, setIsOnline]         = useState(navigator.onLine);
  const navigate = useNavigate();

  // Monitorar conectividade
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    // Bloquear login offline com mensagem clara
    if (!isOnline) {
      toast.error('Sem conexão. O login requer internet.\nSe você já estava logado, recarregue a página.');
      return;
    }

    setLoading(true);
    try {
      const cleanCPF = data.cpf.replace(/\D/g, '');
      const email    = `${cleanCPF}@af.internal`;

      const { error } = await supabase.auth.signInWithPassword({ email, password: data.password });

      if (error) {
        // Tentar formato antigo para compatibilidade
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
            throw new Error('Conta não confirmada. Solicite ao administrador.');
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
    setValue('cpf', formatCPF(e.target.value));
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage: 'url("https://aguiaflorestal.ind.br/wp-content/uploads/2025/07/Fabrica-4-scaled.jpg")',
        }}
      />
      <div className="absolute inset-0 z-10 bg-emerald-950/50 backdrop-brightness-75" />

      {/* Card */}
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

        {/* Aviso offline */}
        {!isOnline && (
          <div className="mb-6 p-3.5 bg-amber-500/20 border border-amber-400/30 rounded-2xl flex items-start gap-3">
            <WifiOff size={18} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-100">
              <p className="font-bold mb-0.5">Sem conexão com a internet</p>
              <p className="text-amber-200/80 text-xs leading-relaxed">
                O login requer conexão. Se você já fez login anteriormente,
                recarregue a página para continuar com os dados salvos.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-emerald-50 mb-1">CPF</label>
            <input
              {...register('cpf')}
              onChange={handleCPFChange}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
            />
            {errors.cpf && (
              <p className="text-red-300 text-xs mt-1">{errors.cpf.message}</p>
            )}
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
            {errors.password && (
              <p className="text-red-300 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isOnline}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : (
              <>
                {isOnline ? <LogIn size={22} /> : <WifiOff size={22} />}
                <span>{isOnline ? 'Entrar no Sistema' : 'Sem Conexão'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
