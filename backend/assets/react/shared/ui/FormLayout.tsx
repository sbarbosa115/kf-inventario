import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type FormEventHandler,
  type ReactNode,
  type RefObject,
} from 'react';

/** How long after a save the first field it marks invalid still takes the focus (the server's answer included). */
const ANSWER_WINDOW_MS = 15_000;

/**
 * After a save, the first field the answer marks invalid (aria-invalid, as `Field` does) takes the focus and comes
 * to the middle of the screen: on a phone Save is at the bottom and the field that says why is often out of sight.
 * Typing in the form, or the window passing, ends the wait; a save that is not refused changes nothing.
 */
function useFocusFirstRefusal(form: RefObject<HTMLFormElement | null>) {
  const waitingSince = useRef<number | null>(null);
  useEffect(() => {
    const node = form.current;
    if (!node) return;
    const stop = () => (waitingSince.current = null);
    const observer = new MutationObserver(() => {
      const since = waitingSince.current;
      if (since === null) return;
      if (Date.now() - since > ANSWER_WINDOW_MS) return stop();
      const first = node.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!first) return;
      stop();
      if (document.activeElement?.getAttribute('aria-invalid') === 'true') {
        return;
      }
      first.focus({preventScroll: true});
      first.scrollIntoView?.({block: 'center'});
    });
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-invalid'],
    });
    node.addEventListener('input', stop);
    return () => {
      observer.disconnect();
      node.removeEventListener('input', stop);
    };
  }, [form]);
  return () => (waitingSince.current = Date.now());
}

/** A form's frame: a readable width (720 px, 640 narrow), two columns from 1280 px with columns={2}. */
export function FormLayout({
  columns = 1,
  narrow = false,
  onSubmit,
  children,
  label,
}: {
  columns?: 1 | 2;
  narrow?: boolean;
  /** With onSubmit the layout is the <form>. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  label?: string;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const awaitAnswer = useFocusFirstRefusal(form);
  const className = [
    'kf-form',
    columns === 2 ? 'kf-form--two' : null,
    narrow ? 'kf-form--narrow' : null,
  ]
    .filter(Boolean)
    .join(' ');
  return onSubmit ? (
    <form
      ref={form}
      className={className}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        awaitAnswer();
        onSubmit(event);
      }}
      noValidate
      aria-label={label}
    >
      {children}
    </form>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** A titled group of fields. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="kf-form-section" aria-labelledby={id}>
      <header className="kf-form-section__header">
        <h2 className="kf-form-section__title" id={id}>
          {title}
        </h2>
        {description && (
          <p className="kf-form-section__description">{description}</p>
        )}
      </header>
      <div className="kf-form-section__body">{children}</div>
    </section>
  );
}

/**
 * The form's actions, sticky at the bottom (above the tab bar on phones): what is missing, Cancel, the main action.
 * `sticky={false}` leaves it in the page's flow while it has nothing to do, so it covers nothing (the scan screen
 * before the first scan: its box sits just above the bar).
 */
export function ActionBar({
  primary,
  secondary,
  status,
  sticky = true,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  status?: ReactNode;
  sticky?: boolean;
}) {
  const bar = useRef<HTMLDivElement>(null);
  // Sticky, the bar covers the bottom of the window: its height joins the root's scroll padding, so a field the
  // browser brings into view (focused, reached with Tab, named by the missing-fields line) stops above it.
  useEffect(() => {
    const node = bar.current;
    if (!node || !sticky) return;
    const root = document.documentElement;
    const follow = () =>
      root.style.setProperty(
        '--kf-action-bar-height',
        `${node.offsetHeight}px`,
      );
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--kf-action-bar-height');
    };
  }, [sticky]);
  return (
    <div
      ref={bar}
      className={`kf-action-bar${sticky ? '' : ' kf-action-bar--static'}`}
    >
      {status && (
        <div className="kf-action-bar__status" aria-live="polite">
          {status}
        </div>
      )}
      <div className="kf-action-bar__buttons">
        {secondary}
        {primary}
      </div>
    </div>
  );
}
