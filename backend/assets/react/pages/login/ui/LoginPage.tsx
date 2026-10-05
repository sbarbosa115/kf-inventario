import {useState, type FormEvent} from 'react';
import {Navigate, useLocation, useNavigate} from 'react-router-dom';
import {signIn, useSession} from '@/entities/session';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import './login.css';

/** The sign-in page. Signed in already: straight to where the person was going. */
export function LoginPage() {
  const {t} = useTranslation();
  const {session, setSession} = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as {from?: string} | null)?.from;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to={from ?? '/admin/products'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSession(await signIn(username, password, rememberMe));
      navigate(from ?? '/admin/products', {replace: true});
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 401
          ? t('auth.invalid')
          : failureMessage(failure, t),
      );
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="card login__card">
        <div className="card-header">
          <h1 className="h5 mb-0">{t('auth.title')}</h1>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <div className="form-group">
              <label htmlFor="login-username">{t('auth.username')}</label>
              <input
                id="login-username"
                className="form-control"
                autoComplete="username"
                required
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">{t('auth.password')}</label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="form-group form-check">
              <input
                id="login-remember"
                type="checkbox"
                className="form-check-input"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="login-remember">
                {t('auth.rememberMe')}
              </label>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={busy || username === '' || password === ''}
            >
              {busy ? t('auth.submitting') : t('auth.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
