import type {ReactNode} from 'react';
import {usePageTitle} from '@/shared/lib';

/**
 * A screen's frame as the legacy pages had it (a title, the actions on its right, the content), restyled without
 * card chrome and naming the browser tab. The screen items replace it with PageHeader.
 */
export function PageCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  usePageTitle(title);
  return (
    <section className="kf-page-card">
      <header className="kf-page-header">
        <div className="kf-page-header__titles">
          <h1 className="kf-page-header__title">{title}</h1>
        </div>
        {actions && <div className="kf-page-header__actions">{actions}</div>}
      </header>
      <div className="kf-page-card__body">{children}</div>
    </section>
  );
}
