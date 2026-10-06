import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';

export interface RowAction {
  label: string;
  /** A Font Awesome class. */
  icon?: string;
  onSelect?: () => void;
  /** Navigation inside the app. */
  href?: string;
  /** A plain link (a file, a PDF in a new tab). */
  external?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** A choice among several (the theme menu): shown checked. */
  checked?: boolean;
}

/**
 * A button opening a menu of actions ("⋯" by default): arrow keys, Home/End, Escape (back to the button), Tab
 * closes. The menu floats over everything (a portal), so a table's scroll box never clips it.
 */
export function RowMenu({
  actions,
  label,
  trigger,
  triggerClassName = 'kf-btn kf-btn--ghost kf-btn--sm kf-btn--icon',
  align = 'end',
  header,
}: {
  actions: RowAction[];
  /** Text above the items (the account menu shows who is signed in); not an item. */
  header?: ReactNode;
  /** The button's accessible name: "Actions for KF-01". */
  label?: string;
  /** What the button shows; "⋯" by default. */
  trigger?: ReactNode;
  triggerClassName?: string;
  align?: 'start' | 'end';
}) {
  const {t} = useTranslation();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{top: number; left: number}>();
  const name = label ?? t('common.actions');

  const items = () => [
    ...(menu.current?.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"])',
    ) ?? []),
  ];

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPosition(undefined);
    if (refocus) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    const rect = button.current.getBoundingClientRect();
    const width = menu.current.offsetWidth;
    const height = menu.current.offsetHeight;
    const left =
      align === 'end'
        ? Math.max(8, rect.right - width)
        : Math.min(rect.left, window.innerWidth - width - 8);
    const below = rect.bottom + 4;
    const top =
      below + height > window.innerHeight && rect.top - height - 4 > 0
        ? rect.top - height - 4
        : below;
    setPosition({top, left});
  }, [open, align]);

  // The first item takes the focus once the menu has its place: while it is still `visibility: hidden` (being
  // measured) a browser ignores `focus()`.
  useEffect(() => {
    if (open && position) items()[0]?.focus();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target))
        close(false);
    };
    const onMove = () => close(false);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, close]);

  const onMenuKey = (event: KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (index: number) => {
      event.preventDefault();
      list[(index + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') go(at + 1);
    else if (event.key === 'ArrowUp') go(at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  };

  const choose = (action: RowAction) => {
    if (action.disabled) return;
    close(!action.href);
    action.onSelect?.();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={triggerClassName}
        aria-label={name}
        title={name}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          event.stopPropagation();
          if (open) close(false);
          else setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger ?? <i className="fas fa-ellipsis-h" aria-hidden="true" />}
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={name}
            className="kf-menu"
            style={
              position
                ? {top: position.top, left: position.left}
                : {visibility: 'hidden'}
            }
            onKeyDown={onMenuKey}
            onClick={(event) => event.stopPropagation()}
          >
            {header && <div className="kf-menu__header">{header}</div>}
            {actions.map((action) => {
              const role =
                action.checked === undefined ? 'menuitem' : 'menuitemradio';
              const className = `kf-menu__item${action.danger ? ' kf-menu__item--danger' : ''}`;
              const content = (
                <>
                  <span className="kf-menu__icon" aria-hidden="true">
                    {action.checked ? (
                      <i className="fas fa-check" />
                    ) : (
                      action.icon && <i className={`fas ${action.icon}`} />
                    )}
                  </span>
                  {action.label}
                </>
              );
              const common = {
                'role': role,
                'className': className,
                'tabIndex': -1,
                'aria-checked': action.checked,
                'aria-disabled': action.disabled || undefined,
              };
              if (action.href && !action.disabled) {
                return action.external ? (
                  <a
                    key={action.label}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...common}
                    onClick={() => choose(action)}
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    key={action.label}
                    to={action.href}
                    {...common}
                    onClick={() => choose(action)}
                  >
                    {content}
                  </Link>
                );
              }
              return (
                <button
                  key={action.label}
                  type="button"
                  {...common}
                  onClick={() => choose(action)}
                >
                  {content}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
