import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useSession} from '@/entities/session';
import {useTranslation} from '@/shared/i18n';
import {Loader} from '@/shared/ui';

/** Signs out (POST, never a link that another site could follow) and goes to the sign-in page. */
export function LogoutPage() {
  const {t} = useTranslation();
  const {signOut} = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    signOut()
      .catch(() => undefined)
      .finally(() => navigate('/admin/login', {replace: true}));
  }, [signOut, navigate]);

  return (
    <div aria-label={t('auth.signingOut')}>
      <Loader />
    </div>
  );
}
