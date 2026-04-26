import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password);
      navigate('/');
    } catch (err) {
      setError('Error al crear cuenta: ' + (err.code || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-surface-container-lowest p-10 rounded-3xl shadow-xl border border-outline-variant/20">
        <div>
          <div className="w-24 h-24 mx-auto flex items-center justify-center mb-6 bg-white rounded-3xl shadow-md p-2">
            <img src="/logo.jpeg" alt="Logo Leis" className="w-full h-full object-contain rounded-2xl" />
          </div>
          <h2 className="mt-4 text-center text-4xl italic text-primary" style={{ fontFamily: "'Noto Serif', serif" }}>
            Crear Cuenta
          </h2>
          <p className="mt-2 text-center text-[10px] text-on-surface-variant font-label uppercase tracking-widest">
            Únete a Leis Inventario
          </p>
        </div>
        
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {error && <div className="bg-error-container text-error p-3 text-sm rounded-lg text-center font-bold">{error}</div>}
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary pl-1 block mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                className="w-full bg-surface-container border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:outline-none px-4 py-3.5 text-on-surface font-body rounded-t-xl transition-all text-sm"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary pl-1 block mb-1">Contraseña</label>
              <input
                type="password"
                required
                className="w-full bg-surface-container border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:outline-none px-4 py-3.5 text-on-surface font-body rounded-t-xl transition-all text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary pl-1 block mb-1">Confirmar Contraseña</label>
              <input
                type="password"
                required
                className="w-full bg-surface-container border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:outline-none px-4 py-3.5 text-on-surface font-body rounded-t-xl transition-all text-sm"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary flex items-center justify-center gap-2 text-on-primary px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-xl hover:bg-primary/90 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? 'Creando cuenta...' : 'Registrarme'}
            </button>
          </div>

          <p className="text-center text-xs text-on-surface-variant mt-4 font-label tracking-wide">
            ¿Ya tienes una cuenta? {' '}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Inicia Sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
