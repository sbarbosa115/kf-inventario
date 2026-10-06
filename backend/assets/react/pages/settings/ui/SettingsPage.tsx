import {NavLink, Route, Routes} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {PageHeader} from '@/shared/ui';
import {AnalyticsSettings} from './AnalyticsSettings';
import {EmailSettings} from './EmailSettings';
import {GeneralSettings} from './GeneralSettings';
import {QuickPhrases} from './QuickPhrases';
import {ShopConnections} from './ShopConnections';
import './settings.css';

const TABS = [
  {key: 'general', to: '/admin/settings', end: true},
  {key: 'email', to: '/admin/settings/email', end: false},
  {key: 'analytics', to: '/admin/settings/analytics', end: false},
  {key: 'shops', to: '/admin/settings/shops', end: false},
  {key: 'phrases', to: '/admin/settings/phrases', end: false},
] as const;

/**
 * Settings (/admin/settings/*, ROLE_ADMIN: docs/pdr/prd-shops-settings.md, "Screen proposals" 2): the tabs as a nav
 * of links (they scroll sideways on a phone), each tab its own address. General is item 0's; Email, Analytics and
 * Quick phrases are item 4's, Shop connections item 6's (each in its own file next to this one).
 */
export function SettingsPage() {
  const {t} = useTranslation();
  return (
    <>
      <PageHeader title={t('settings.title')} />
      <nav className="kf-settings__tabs" aria-label={t('settings.tabsLabel')}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.end}
            className={({isActive}) =>
              `kf-settings__tab${isActive ? ' is-active' : ''}`
            }
          >
            {t(`settings.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <div className="kf-settings__panel">
        <Routes>
          <Route index element={<GeneralSettings />} />
          <Route path="email" element={<EmailSettings />} />
          <Route path="analytics" element={<AnalyticsSettings />} />
          <Route path="shops" element={<ShopConnections />} />
          <Route path="phrases" element={<QuickPhrases />} />
        </Routes>
      </div>
    </>
  );
}
