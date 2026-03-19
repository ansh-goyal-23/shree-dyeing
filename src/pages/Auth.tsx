import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const Auth: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required.');
      return;
    }
    setLoading(true);
    const { error } = isLogin
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);

    if (error) {
      toast.error(error.message);
    } else if (!isLogin) {
      toast.success('Account created! You can now log in.');
      setIsLogin(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-mono text-xl font-semibold tracking-tight">SHREE DYEING</h1>
          <p className="text-sm text-muted-foreground mt-1">Factory Management Software</p>
        </div>

        <div className="card-industrial p-6 space-y-5">
          <h2 className="text-lg font-semibold">{isLogin ? 'Log In' : 'Sign Up'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-industrial w-full"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-industrial w-full"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
