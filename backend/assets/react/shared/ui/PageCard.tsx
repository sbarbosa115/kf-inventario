import type {ReactNode} from 'react';

/** A screen's frame: its title, the actions on its right, and its content (the legacy pages' card). */
export function PageCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card mb-3">
      <header className="card-header d-flex align-items-center">
        <h1 className="h5 mb-0 mr-auto">{title}</h1>
        {actions}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}
