import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, UserPlus } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';

type LoginPageProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name?: string) => Promise<void>;
  loading?: boolean;
};

const LoginPage = ({ onLogin, onRegister, loading }: LoginPageProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name);
      }
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || loading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-200 dark:bg-neutral-900 text-neutral-700 dark:text-white px-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-gray-300 dark:bg-neutral-900/70 border border-black/10 dark:border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-violet-500 to-cyan-400 animate-pulse" />
          <h1 className="text-2xl font-bold">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>
        </div>
        <p className="text-neutral-400 mb-6">
          {mode === 'login'
            ? 'Accédez à vos collections avec votre email et votre mot de passe.'
            : 'Créez un compte pour gérer vos collections et vos permissions.'}
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="text-sm text-neutral-600 dark:text-neutral-300">Nom</label>
              <input
                type="text"
                className="w-full bg-gray-200 dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="Votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm text-neutral-600 dark:text-neutral-300">Email</label>
            <input
              type="email"
              className="w-full bg-gray-200 dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="vous@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-neutral-600 dark:text-neutral-300">Mot de passe</label>
            <input
              type="password"
              className="w-full bg-gray-200 dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

          <ShinyButton type="submit" disabled={disabled} className={disabled ? 'opacity-60 pointer-events-none' : ''}>
            {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </ShinyButton>
        </form>

        <div className="mt-4 text-sm text-neutral-400">
          {mode === 'login' ? (
            <button className="text-cyan-400" onClick={() => setMode('register')}>
              Pas de compte ? Créez-en un.
            </button>
          ) : (
            <button className="text-cyan-400" onClick={() => setMode('login')}>
              Déjà inscrit ? Connectez-vous.
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
