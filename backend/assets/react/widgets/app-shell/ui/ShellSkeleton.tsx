import {Skeleton} from '@/shared/ui';
import './app-shell.css';

/** The shell's outline while the session is asked (no spinner): the sidebar's place, the top bar, the page. */
export function ShellSkeleton() {
  return (
    <div className="kf-shell kf-shell-skeleton">
      <aside className="kf-sidebar" aria-hidden="true" />
      <div className="kf-shell__body">
        <div className="kf-topbar" aria-hidden="true" />
        <div className="kf-main__inner">
          <Skeleton variant="text" lines={6} />
        </div>
      </div>
    </div>
  );
}
