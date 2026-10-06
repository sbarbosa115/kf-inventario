import {useTranslation} from '@/shared/i18n';
import {useTheme, type ThemePreference} from '@/shared/lib';
import {RowMenu} from './RowMenu';

const ICONS: Record<ThemePreference, string> = {
  light: 'fa-sun',
  dark: 'fa-moon',
  system: 'fa-circle-half-stroke',
};

/** "Theme: Light / Dark / System", remembered per browser (kf.theme). */
export function ThemeSwitch({className}: {className?: string}) {
  const {t} = useTranslation();
  const [preference, setPreference] = useTheme();
  const options: ThemePreference[] = ['light', 'dark', 'system'];
  return (
    <RowMenu
      label={t('common.theme.current', {
        theme: t(`common.theme.${preference}`),
      })}
      trigger={<i className={`fas ${ICONS[preference]}`} aria-hidden="true" />}
      triggerClassName={className}
      actions={options.map((option) => ({
        label: t(`common.theme.${option}`),
        checked: option === preference,
        onSelect: () => setPreference(option),
      }))}
    />
  );
}
