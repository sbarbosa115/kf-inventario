import {useEffect, useRef, type RefObject} from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Open dialogs, topmost last: only that one handles Escape and Tab. A dialog rendered inside another one sits above
 * it even when both mount together (React runs the inner effect first).
 */
const open: {root: HTMLElement | null}[] = [];

/**
 * While a dialog is open: focus moves into it, Tab and Shift+Tab stay inside it, Escape calls onEscape, the page
 * behind does not scroll, and the focus goes back where it was when it closes. With dialogs stacked (a confirm over a
 * slide-over), only the most recent one answers the keys.
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = container.current;
    const focusables = () =>
      root
        ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
            (el) => !el.closest('[aria-hidden="true"]'),
          )
        : [];
    const first = root?.querySelector<HTMLElement>('[autofocus]') ?? root;
    first?.focus();
    const token = {root};
    const inner = open.findIndex(
      (other) => !!root && !!other.root && root.contains(other.root),
    );
    open.splice(inner === -1 ? open.length : inner, 0, token);
    const onKey = (event: KeyboardEvent) => {
      if (open[open.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        escape.current();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const [head, tail] = [items[0]!, items[items.length - 1]!];
      const active = document.activeElement;
      if (event.shiftKey && (active === head || active === root)) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && active === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(token), 1);
      document.body.style.overflow = overflow;
      if (open.length === 0) document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, [container]);
}
