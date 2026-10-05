import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {useSession} from '@/entities/session';
import {APP_NAME} from '@/shared/config';
import {useTranslation} from '@/shared/i18n';
import {
  readSetting,
  useCurrentPageTitle,
  useViewport,
  writeSetting,
} from '@/shared/lib';
import {LanguageSwitch, RowMenu, ThemeSwitch, useFocusTrap} from '@/shared/ui';
import {
  activeEntry,
  entriesFor,
  GROUPS,
  tabsFor,
  type NavEntry,
} from '../model/entries';
import './app-shell.css';

const SIDEBAR_KEY = 'kf.sidebar';

/**
 * The frame of every signed-in page. From 1024 px: a sidebar (collapsible to a rail of icons, remembered) with the
 * entries the person's roles open. Below: a drawer behind "Menu" and a bottom tab bar. Only one navigation is in
 * the page at a time, so no link name appears twice. The top bar: the scan shortcut, language, theme, the account.
 */
export function AppShell({children}: {children: ReactNode}) {
  const {t} = useTranslation();
  const {session} = useSession();
  const {pathname} = useLocation();
  const viewport = useViewport();
  const pageTitle = useCurrentPageTitle();
  const [rail, setRail] = useState(() => readSetting(SIDEBAR_KEY) === 'rail');
  // The drawer remembers the address it was opened on: following one of its links closes it.
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const roles = session?.roles ?? [];
  const entries = entriesFor(roles);
  const active = activeEntry(pathname, entries);
  const compact = viewport === 'compact';
  const drawer = compact && drawerAt === pathname;
  const name = session?.name || session?.username || '';

  useEffect(() => {
    document.body.classList.toggle('kf-has-tabbar', compact);
    return () => document.body.classList.remove('kf-has-tabbar');
  }, [compact]);

  const toggleRail = () => {
    writeSetting(SIDEBAR_KEY, rail ? 'full' : 'rail');
    setRail(!rail);
  };
  const behindDrawer = compact && drawer;

  return (
    <div
      className={`kf-shell${compact ? ' kf-shell--compact' : ''}${!compact && rail ? ' kf-shell--rail' : ''}`}
    >
      <a className="kf-skip" href="#main">
        {t('nav.skip')}
      </a>
      {!compact && (
        <aside className="kf-sidebar">
          <Brand compact={rail} />
          <nav className="kf-sidebar__nav" aria-label={t('nav.main')}>
            <Groups entries={entries} active={active} rail={rail} />
          </nav>
          <button
            type="button"
            className="kf-sidebar__collapse"
            aria-expanded={!rail}
            aria-label={rail ? t('nav.expand') : t('nav.collapse')}
            title={rail ? t('nav.expand') : t('nav.collapse')}
            onClick={toggleRail}
          >
            <i
              className={`fas ${rail ? 'fa-angles-right' : 'fa-angles-left'}`}
              aria-hidden="true"
            />
            {!rail && <span aria-hidden="true">{t('nav.collapse')}</span>}
          </button>
        </aside>
      )}
      <div className="kf-shell__body" aria-hidden={behindDrawer || undefined}>
        <header className="kf-topbar">
          {compact && (
            <>
              <button
                type="button"
                className="kf-topbar__icon"
                aria-label={t('nav.menu')}
                aria-expanded={drawer}
                onClick={() => setDrawerAt(pathname)}
              >
                <i className="fas fa-bars" aria-hidden="true" />
              </button>
              <img
                className="kf-topbar__mark"
                src="/images/kf-mark.svg"
                alt=""
                width="28"
                height="28"
              />
              <span className="kf-topbar__title">{pageTitle ?? APP_NAME}</span>
            </>
          )}
          <div className="kf-topbar__end">
            {roles.includes('ROLE_MANAGE_INVENTORY') && (
              <Link
                className="kf-topbar__icon"
                to="/admin/products/barcode"
                aria-label={t('nav.scanShortcut')}
                title={t('nav.scanShortcut')}
              >
                <i className="fas fa-barcode" aria-hidden="true" />
              </Link>
            )}
            <LanguageSwitch />
            <ThemeSwitch className="kf-topbar__icon" />
            <RowMenu
              label={name || t('nav.account')}
              triggerClassName="kf-topbar__account"
              trigger={
                <>
                  <span className="kf-topbar__avatar" aria-hidden="true">
                    {initials(name)}
                  </span>
                  <span className="kf-topbar__name">{name}</span>
                  <i className="fas fa-chevron-down" aria-hidden="true" />
                </>
              }
              header={
                <>
                  <div className="kf-topbar__menu-user">
                    {session?.username}
                  </div>
                  {session?.email && (
                    <div className="kf-topbar__menu-email">{session.email}</div>
                  )}
                </>
              }
              actions={[
                {
                  label: t('nav.logout'),
                  icon: 'fa-right-from-bracket',
                  href: '/admin/logout',
                },
              ]}
            />
          </div>
        </header>
        <main id="main" className="kf-main" tabIndex={-1}>
          <div className="kf-main__inner">{children}</div>
          <footer className="kf-main__footer">
            {t('common.footer', {year: new Date().getFullYear()})}
          </footer>
        </main>
      </div>
      {compact && !drawer && (
        <nav className="kf-tabbar" aria-label={t('nav.tabs')}>
          {tabsFor(entries).map((entry) => (
            <Link
              key={entry.key}
              to={entry.to}
              className="kf-tabbar__item"
              aria-current={entry.key === active ? 'page' : undefined}
            >
              <i className={`fas ${entry.icon}`} aria-hidden="true" />
              <span>{t(entry.label)}</span>
            </Link>
          ))}
          <button
            type="button"
            className="kf-tabbar__item"
            aria-expanded={false}
            onClick={() => setDrawerAt(pathname)}
          >
            <i className="fas fa-ellipsis" aria-hidden="true" />
            <span>{t('nav.more')}</span>
          </button>
        </nav>
      )}
      {compact && drawer && (
        <Drawer
          entries={entries}
          active={active}
          onClose={() => setDrawerAt(null)}
        />
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function Brand({compact = false}: {compact?: boolean}) {
  return (
    <Link className="kf-brand" to="/admin/products" title={APP_NAME}>
      <img
        className="kf-brand__mark"
        src="/images/kf-mark.svg"
        alt=""
        width="32"
        height="32"
      />
      <span className={compact ? 'sr-only' : 'kf-brand__name'}>{APP_NAME}</span>
    </Link>
  );
}

function Groups({
  entries,
  active,
  rail = false,
  onNavigate,
}: {
  entries: NavEntry[];
  active: string | undefined;
  rail?: boolean;
  onNavigate?: () => void;
}) {
  const {t} = useTranslation();
  return (
    <>
      {GROUPS.map((group) => {
        const mine = entries.filter((entry) => entry.group === group);
        if (mine.length === 0) return null;
        return (
          <div key={group} className="kf-nav-group">
            <p className={rail ? 'sr-only' : 'kf-nav-group__label'}>
              {t(`nav.sections.${group}`)}
            </p>
            <ul className="kf-nav-group__list">
              {mine.map((entry) => (
                <li key={entry.key}>
                  <Link
                    to={entry.to}
                    className="kf-nav-link"
                    aria-current={entry.key === active ? 'page' : undefined}
                    title={rail ? t(entry.label) : undefined}
                    onClick={onNavigate}
                  >
                    <i
                      className={`fas fa-fw ${entry.icon}`}
                      aria-hidden="true"
                    />
                    <span className={rail ? 'sr-only' : undefined}>
                      {t(entry.label)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function Drawer({
  entries,
  active,
  onClose,
}: {
  entries: NavEntry[];
  active: string | undefined;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, onClose);
  return (
    <div className="kf-drawer">
      <div
        className="kf-drawer__backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panel}
        className="kf-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.main')}
        tabIndex={-1}
      >
        <div className="kf-drawer__header">
          <Brand />
          <button
            type="button"
            className="kf-topbar__icon"
            aria-label={t('nav.closeMenu')}
            onClick={onClose}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
        <nav className="kf-sidebar__nav" aria-label={t('nav.main')}>
          <Groups entries={entries} active={active} onNavigate={onClose} />
        </nav>
      </div>
    </div>
  );
}
