import {useId, type ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import {Button, useToast} from '@/shared/ui';

/** Copies a text to the clipboard and says so (or says to copy it by hand where the browser refuses). */
export function useCopy() {
  const {t} = useTranslation();
  const toast = useToast();
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('shops.webhook.copied'));
    } catch {
      toast.error(t('shops.webhook.copyFailed'));
    }
  };
}

/** A read-only value to paste somewhere else (mono), with its Copy button and, maybe, more buttons. */
export function CopyField({
  label,
  value,
  copyLabel,
  onCopy,
  placeholder,
  hint,
  extra,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => void;
  placeholder?: string;
  hint?: ReactNode;
  extra?: ReactNode;
}) {
  const {t} = useTranslation();
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="kf-copy-field">
        <input
          id={id}
          className="form-control kf-mono"
          readOnly
          value={value}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={(event) => event.currentTarget.select()}
        />
        {extra}
        <Button icon="fa-copy" aria-label={copyLabel} onClick={onCopy}>
          {t('shops.webhook.copy')}
        </Button>
      </div>
      {hint && (
        <small className="form-text" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}
