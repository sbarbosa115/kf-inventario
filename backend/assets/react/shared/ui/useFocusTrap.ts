import {useEffect, useRef, type RefObject} from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While a dialog is open: focus moves into it, Tab and Shift+Tab stay inside it, Escape calls onEscape, the page
 * behind does not scroll, and the focus goes back where it was when it closes.
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
    const onKey = (event: KeyboardEvent) => {
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
      document.body.style.overflow = overflow;
      document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, [container]);
}
