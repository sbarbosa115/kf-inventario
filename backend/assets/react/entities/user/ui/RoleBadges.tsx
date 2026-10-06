import './role-badges.css';
import {useTranslation} from '@/shared/i18n';
import {StatusBadge} from '@/shared/ui';
import {isNamedRole, roleTone, visibleRoles} from '../model/roles';

/** A user's roles as chips with their plain names ("Admin", "Orders: update"), never the ROLE_ constants. */
export function RoleBadges({roles}: {roles: string[]}) {
  const {t} = useTranslation();
  const shown = visibleRoles(roles);
  if (shown.length === 0) {
    return <span className="text-muted">{t('users.noRoles')}</span>;
  }
  return (
    <span className="kf-role-chips">
      {shown.map((role) => (
        <StatusBadge key={role} tone={roleTone(role)}>
          {isNamedRole(role) ? t(`roles.names.${role}`) : role}
        </StatusBadge>
      ))}
    </span>
  );
}
