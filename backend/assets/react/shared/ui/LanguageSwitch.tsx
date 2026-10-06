import {LOCALES, useTranslation, type Locale} from '@/shared/i18n';

/** EN / ES: the UI language, remembered per browser. The page keeps its address and its data. */
export function LanguageSwitch() {
  const {t, locale, setLocale} = useTranslation();
  const move = (step: number, group: HTMLElement) => {
    const i =
      (LOCALES.indexOf(locale) + step + LOCALES.length) % LOCALES.length;
    const next = LOCALES[i];
    if (!next) return;
    setLocale(next);
    group.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus();
  };
  return (
    <div
      className="kf-segmented kf-segmented--sm"
      role="radiogroup"
      aria-label={t('common.language.label')}
      onKeyDown={(event) => {
        if (
          ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          move(
            event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1,
            event.currentTarget,
          );
        }
      }}
    >
      {LOCALES.map((option: Locale) => (
        <button
          key={option}
          type="button"
          role="radio"
          lang={option}
          aria-checked={option === locale}
          aria-label={t(`common.language.${option}`)}
          title={t(`common.language.${option}`)}
          tabIndex={option === locale ? 0 : -1}
          className="kf-segmented__option"
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
