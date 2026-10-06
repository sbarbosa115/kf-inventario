import './filters.css';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';

/**
 * A filter's button and the panel it opens under it (a checkbox list, two dates, a range). The panel floats in a
 * portal, so a table's scroll box never clips it; a click outside or Escape (back to the button) closes it, and it
 * follows its button when the page scrolls.
 */
export function FilterPopover({
  label,
  active,
  className,
  children,
}: {
  /** What the button shows ("Status · 2"); also its accessible name. */
  label: string;
  /** The filter filters something: the button shows it. */
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Under the button, or above it when there is more room there; never taller than the room it has.
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  }>();

  const close = (refocus = false) => {
    setOpen(false);
    setPosition(undefined);
    if (refocus) button.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !button.current || !panel.current) return;
    const rect = button.current.getBoundingClientRect();
    const width = panel.current.offsetWidth;
    const height = panel.current.scrollHeight;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const up = height > below && above > below;
    const room = up ? above : below;
    setPosition({
      top: up
        ? Math.max(8, rect.top - 4 - Math.min(height, room))
        : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      maxHeight: Math.max(160, room),
    });
  }, [open]);

  useEffect(() => {
    if (open && position) {
      panel.current
        ?.querySelector<HTMLElement>('input, button, select')
        ?.focus();
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target))
        close();
    };
    // The page scrolled or changed under the panel: it follows its button, and closes only when the button left the
    // window.
    const onScroll = (event: Event) => {
      if (panel.current?.contains(event.target as Node)) return;
      const rect = button.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        close();
        return;
      }
      const width = panel.current?.offsetWidth ?? 0;
      const height = panel.current?.scrollHeight ?? 0;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const up = height > below && above > below;
      const room = up ? above : below;
      setPosition({
        top: up
          ? Math.max(8, rect.top - 4 - Math.min(height, room))
          : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        maxHeight: Math.max(160, room),
      });
    };
    // Escape closes it wherever the focus is (a control inside may have gone disabled and dropped it).
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      setPosition(undefined);
      button.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`kf-filter-button${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="kf-filter-button__label">{label}</span>
        <i className="fas fa-chevron-down" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            className="kf-filter-popover"
            style={
              position
                ? {
                    top: position.top,
                    left: position.left,
                    maxHeight: position.maxHeight,
                  }
                : {visibility: 'hidden'}
            }
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
