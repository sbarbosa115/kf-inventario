import {useState, type FormEvent, type KeyboardEvent} from 'react';
import {
  createQuickPhrase,
  deleteQuickPhrase,
  listQuickPhrases,
  reorderQuickPhrases,
  updateQuickPhrase,
  type QuickPhrase,
} from '@/entities/settings';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  Button,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
  useToast,
} from '@/shared/ui';

const MAX = 255;

/** Settings › Quick phrases: the admin's editor (add, rename, order, switch off, delete), with a preview of the bar. */
export function QuickPhraseAdmin() {
  const phrases = useLoad(() => listQuickPhrases(true), []);
  if (phrases.error) {
    return <ErrorState error={phrases.error} onRetry={phrases.reload} />;
  }
  if (!phrases.data) return <Skeleton variant="form" />;
  return <Editor initial={phrases.data} />;
}

function Editor({initial}: {initial: QuickPhrase[]}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{id: number; text: string} | null>(
    null,
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<QuickPhrase | null>(null);
  const [busy, setBusy] = useState(false);

  /** Runs one request; a failure is a toast (the list is left as it was). */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 403
          ? t('errors.forbidden')
          : failureMessage(error, t),
      );
    } finally {
      setBusy(false);
    }
  };

  const fieldMessage = (error: unknown): string | null => {
    if (!(error instanceof ApiError) || error.status !== 422) return null;
    const first = (error.body as {violations?: {message: string}[]} | null)
      ?.violations?.[0];
    return first?.message ?? t('settings.phrases.tooLong');
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text === '') {
      setAddError(t('settings.phrases.blank'));
      return;
    }
    setAddError(null);
    setBusy(true);
    try {
      const created = await createQuickPhrase({text, active: true});
      setItems((now) => [...now, created]);
      setDraft('');
      toast.success(t('settings.phrases.added'));
    } catch (error) {
      const message = fieldMessage(error);
      if (message) setAddError(message);
      else toast.error(failureMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const replace = (phrase: QuickPhrase) =>
    setItems((now) => now.map((one) => (one.id === phrase.id ? phrase : one)));

  const rename = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    const current = items.find((one) => one.id === editing.id);
    if (!current) return;
    if (text === '') {
      setEditError(t('settings.phrases.blank'));
      return;
    }
    if (text === current.text) {
      setEditing(null);
      return;
    }
    setEditError(null);
    setBusy(true);
    try {
      replace(
        await updateQuickPhrase(current.id, {text, active: current.active}),
      );
      setEditing(null);
      toast.success(t('settings.phrases.renamed'));
    } catch (error) {
      const message = fieldMessage(error);
      if (message) setEditError(message);
      else toast.error(failureMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const onEditKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void rename();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setEditing(null);
      setEditError(null);
    }
  };

  const toggle = (phrase: QuickPhrase) =>
    run(async () => {
      replace(
        await updateQuickPhrase(phrase.id, {
          text: phrase.text,
          active: !phrase.active,
        }),
      );
      toast.success(t('settings.phrases.updated'));
    });

  const move = (index: number, by: -1 | 1) =>
    run(async () => {
      const next = [...items];
      const other = next[index + by];
      const moved = next[index];
      if (!other || !moved) return;
      next[index] = other;
      next[index + by] = moved;
      const before = items;
      setItems(next);
      try {
        setItems(await reorderQuickPhrases(next.map((one) => one.id)));
        toast.success(t('settings.phrases.reordered'));
      } catch (error) {
        setItems(before);
        throw error;
      }
    });

  const remove = () =>
    run(async () => {
      if (!deleting) return;
      await deleteQuickPhrase(deleting.id);
      setItems((now) => now.filter((one) => one.id !== deleting.id));
      setDeleting(null);
      toast.success(t('settings.phrases.deleted'));
    });

  const active = items.filter((one) => one.active);
  return (
    <div className="kf-phrases">
      <p className="kf-settings__muted">{t('settings.phrases.intro')}</p>
      <form className="kf-phrases__add" onSubmit={add} noValidate>
        <div className="kf-phrases__add-field">
          <Field label={t('settings.phrases.addLabel')} error={addError}>
            <input
              className="form-control"
              value={draft}
              maxLength={MAX}
              placeholder={t('settings.phrases.addPlaceholder')}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" variant="primary" icon="fa-plus" loading={busy}>
          {t('settings.phrases.add')}
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon="fa-comment-dots"
          message={t('settings.phrases.empty')}
        />
      ) : (
        <ul
          className="kf-phrases__list"
          aria-label={t('settings.phrases.listLabel')}
        >
          {items.map((phrase, index) => (
            <li
              key={phrase.id}
              className={`kf-phrases__row${phrase.active ? '' : ' is-inactive'}`}
            >
              {editing?.id === phrase.id ? (
                <div className="kf-phrases__edit">
                  <Field
                    label={t('settings.phrases.renameField')}
                    error={editError}
                  >
                    <input
                      className="form-control"
                      value={editing.text}
                      maxLength={MAX}
                      autoFocus
                      onChange={(event) =>
                        setEditing({id: phrase.id, text: event.target.value})
                      }
                      onKeyDown={onEditKey}
                    />
                  </Field>
                  <div className="kf-phrases__edit-actions">
                    <Button
                      variant="primary"
                      loading={busy}
                      onClick={() => void rename()}
                    >
                      {t('settings.phrases.saveRename')}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditing(null);
                        setEditError(null);
                      }}
                    >
                      {t('settings.phrases.cancelRename')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="kf-phrases__text">{phrase.text}</span>
                  <div className="kf-phrases__actions">
                    <label className="kf-phrases__switch">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={phrase.active}
                        disabled={busy}
                        aria-label={t('settings.phrases.activeFor', {
                          text: phrase.text,
                        })}
                        onChange={() => void toggle(phrase)}
                      />
                      <span>{t('settings.phrases.active')}</span>
                    </label>
                    <Button
                      variant="ghost"
                      icon="fa-arrow-up"
                      disabled={busy || index === 0}
                      aria-label={t('settings.phrases.moveUp', {
                        text: phrase.text,
                      })}
                      onClick={() => void move(index, -1)}
                    />
                    <Button
                      variant="ghost"
                      icon="fa-arrow-down"
                      disabled={busy || index === items.length - 1}
                      aria-label={t('settings.phrases.moveDown', {
                        text: phrase.text,
                      })}
                      onClick={() => void move(index, 1)}
                    />
                    <Button
                      variant="ghost"
                      icon="fa-pen"
                      disabled={busy}
                      aria-label={t('settings.phrases.rename', {
                        text: phrase.text,
                      })}
                      onClick={() => {
                        setEditError(null);
                        setEditing({id: phrase.id, text: phrase.text});
                      }}
                    />
                    <Button
                      variant="ghost"
                      icon="fa-trash"
                      disabled={busy}
                      aria-label={t('settings.phrases.delete', {
                        text: phrase.text,
                      })}
                      onClick={() => setDeleting(phrase)}
                    />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div
        className="kf-phrases__preview"
        role="group"
        aria-label={t('settings.phrases.preview')}
      >
        <h2 className="kf-phrases__preview-title">
          {t('settings.phrases.preview')}
        </h2>
        {active.length === 0 ? (
          <p className="kf-settings__muted">
            {t('settings.phrases.previewEmpty')}
          </p>
        ) : (
          <div className="kf-chips">
            {active.map((phrase) => (
              <span key={phrase.id} className="kf-chip kf-phrases__chip">
                {phrase.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {deleting && (
        <ConfirmModal
          title={t('settings.phrases.deleteTitle')}
          confirmLabel={t('settings.phrases.deleteConfirm')}
          danger
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        >
          {t('settings.phrases.deleteBody', {text: deleting.text})}
        </ConfirmModal>
      )}
    </div>
  );
}
