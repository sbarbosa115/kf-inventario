import {useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  createUser,
  emptyUserForm,
  ROLE_GROUPS,
  updateUser,
  userFormToPayload,
  userToForm,
  validateUserForm,
  violationsToErrors,
  type User,
  type UserFormErrors,
  type UserFormValues,
} from '@/entities/user';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {
  ActionBar,
  Button,
  Field,
  FormLayout,
  FormSection,
  PasswordField,
  useToast,
} from '@/shared/ui';
import './user-form.css';

/** The user's fields. Without `user` it creates one; with it, it edits that one (a blank password keeps theirs). */
export function UserForm({user}: {user?: User}) {
  const {t} = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState<UserFormValues>(() =>
    user ? userToForm(user) : emptyUserForm(),
  );
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof UserFormValues>(
    key: K,
    value: UserFormValues[K],
  ) => setValues((now) => ({...now, [key]: value}));

  const toggleRole = (role: string, on: boolean) =>
    set(
      'roles',
      on ? [...values.roles, role] : values.roles.filter((r) => r !== role),
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const found = validateUserForm(values, user === undefined, t);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const payload = userFormToPayload(values);
      if (user) {
        await updateUser(user.id, payload);
      } else {
        await createUser(payload);
      }
      toast.success(t(user ? 'users.updated' : 'users.created'));
      navigate('/admin/users');
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(violationsToErrors(error.body));
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(t('errors.forbidden'));
      } else if (error instanceof ApiError && error.status === 404) {
        setFailure(t('users.notFound'));
      } else {
        setFailure(failureMessage(error, t));
      }
      setBusy(false);
    }
  };

  return (
    <FormLayout narrow onSubmit={submit} label={t('users.form.account')}>
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <FormSection
        title={t('users.form.account')}
        description={t('users.form.accountHint')}
      >
        <Field label={t('users.form.name')} error={errors.name}>
          <input
            className="form-control"
            value={values.name}
            maxLength={255}
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>
        <Field label={t('users.form.email')} error={errors.email}>
          <input
            type="email"
            className="form-control"
            value={values.email}
            maxLength={255}
            onChange={(event) => set('email', event.target.value)}
          />
        </Field>
        <Field label={t('users.form.username')} error={errors.username}>
          <input
            className="form-control"
            autoComplete="off"
            value={values.username}
            maxLength={255}
            onChange={(event) => set('username', event.target.value)}
          />
        </Field>
        <PasswordField
          label={t('users.form.password')}
          value={values.password}
          onChange={(value) => set('password', value)}
          autoComplete="new-password"
          error={errors.password}
        />
        {user && (
          <p className="form-text text-muted small mt-n2 mb-3">
            {t('users.form.passwordKeep')}
          </p>
        )}
        <Field label={t('users.form.status')} error={errors.enabled}>
          <select
            className="form-control"
            value={values.enabled ? '1' : '0'}
            onChange={(event) => set('enabled', event.target.value === '1')}
          >
            <option value="1">{t('users.form.enabled')}</option>
            <option value="0">{t('users.form.disabled')}</option>
          </select>
        </Field>
      </FormSection>
      <FormSection
        title={t('users.form.roles')}
        description={t('users.form.rolesHint')}
      >
        {ROLE_GROUPS.map((group) => (
          <fieldset className="kf-role-group" key={group.key}>
            <legend className="kf-role-group__legend">
              {t(`roles.groups.${group.key}`)}
            </legend>
            {group.key === 'admin' && (
              <p className="kf-role-group__note">{t('roles.adminNote')}</p>
            )}
            {group.roles.map((role) => (
              <div className="kf-role" key={role}>
                <input
                  id={`role-${role}`}
                  type="checkbox"
                  className="kf-role__input"
                  aria-describedby={`role-${role}-description`}
                  checked={values.roles.includes(role)}
                  onChange={(event) => toggleRole(role, event.target.checked)}
                />
                <div className="kf-role__text">
                  <label className="kf-role__name" htmlFor={`role-${role}`}>
                    {t(`roles.names.${role}`)}
                  </label>
                  <span
                    className="kf-role__description"
                    id={`role-${role}-description`}
                  >
                    {t(`roles.descriptions.${role}`)}
                  </span>
                </div>
              </div>
            ))}
          </fieldset>
        ))}
        {errors.roles && (
          <div className="text-danger small mt-1" role="alert">
            {errors.roles}
          </div>
        )}
      </FormSection>
      <ActionBar
        secondary={
          <Button to="/admin/users" variant="ghost">
            {t('common.cancel')}
          </Button>
        }
        primary={
          <Button type="submit" variant="primary" loading={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
        }
      />
    </FormLayout>
  );
}
