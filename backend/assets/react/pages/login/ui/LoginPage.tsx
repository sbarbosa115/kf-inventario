import {useRef, useState, type FormEvent} from 'react';
import {Navigate, useLocation, useNavigate} from 'react-router-dom';
import {signIn, useSession} from '@/entities/session';
import {ApiError, failureMessage} from '@/shared/api';
import {APP_NAME} from '@/shared/config';
import {useTranslation} from '@/shared/i18n';
import {usePageTitle} from '@/shared/lib';
import {Button, LanguageSwitch, PasswordField} from '@/shared/ui';
import './login.css';

/**
 * The sign-in page: the KF mark on an olive panel and the form beside it (one column on phones). Signed in already:
 * straight to where the person was going.
 */
export function LoginPage() {
  const {t} = useTranslation();
  const {session, setSession} = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as {from?: string} | null)?.from;
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageTitle(t('auth.title'));

  if (session) return <Navigate to={from ?? '/admin/products'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (username.trim() === '' || password === '') {
      setError(t('auth.missing'));
      if (username.trim() === '') usernameInput.current?.focus();
      else passwordInput.current?.focus();
      return;
    }
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
    <div className="kf-login">
      <section className="kf-login__brand" aria-label={APP_NAME}>
        <img
          className="kf-login__mark"
          src="/images/kf-mark.svg"
          alt=""
          width="112"
          height="112"
        />
        <p className="kf-login__name">{APP_NAME}</p>
        <p className="kf-login__tagline">{t('auth.tagline')}</p>
      </section>
      <main className="kf-login__panel">
        <div className="kf-login__card">
          <img
            className="kf-login__mark-small"
            src="/images/kf-mark.svg"
            alt=""
            width="48"
            height="48"
          />
          <h1 className="kf-login__title">{t('auth.title')}</h1>
          <form onSubmit={submit} noValidate>
            <div className="form-group">
              <label htmlFor="login-username">{t('auth.username')}</label>
              <input
                ref={usernameInput}
                id="login-username"
                className="form-control"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                required
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <PasswordField
              label={t('auth.password')}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
              inputRef={passwordInput}
            />
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
            {error && (
              <div className="kf-login__error" role="alert">
                <i className="fas fa-circle-exclamation" aria-hidden="true" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={busy}
              className="kf-login__submit"
            >
              {t('auth.submit')}
            </Button>
          </form>
          <div className="kf-login__language">
            <LanguageSwitch />
          </div>
        </div>
      </main>
    </div>
  );
}
