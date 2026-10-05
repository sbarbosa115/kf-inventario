import {useState, type FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {
  createUser,
  emptyUserForm,
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
import {ASSIGNABLE_ROLES} from '@/shared/config';
import {useTranslation} from '@/shared/i18n';
import {Field} from '@/shared/ui';

/** The user's fields. Without `user` it creates one; with it, it edits that one (a blank password keeps theirs). */
export function UserForm({user}: {user?: User}) {
  const {t} = useTranslation();
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
      navigate('/admin/users', {
        state: {saved: user ? 'updated' : 'created'},
      });
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
    <form onSubmit={submit} noValidate>
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
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
      <Field label={t('users.form.password')} error={errors.password}>
        <input
          type="password"
          className="form-control"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => set('password', event.target.value)}
        />
      </Field>
      {user && (
        <p className="form-text text-muted small mt-n2 mb-3">
          {t('users.form.passwordKeep')}
        </p>
      )}
      <fieldset className="form-group">
        <legend className="col-form-label">{t('users.form.roles')}</legend>
        {ASSIGNABLE_ROLES.map((role) => (
          <div className="form-check" key={role}>
            <input
              id={`role-${role}`}
              type="checkbox"
              className="form-check-input"
              checked={values.roles.includes(role)}
              onChange={(event) => toggleRole(role, event.target.checked)}
            />
            <label className="form-check-label" htmlFor={`role-${role}`}>
              {role}
            </label>
          </div>
        ))}
        {errors.roles && (
          <div className="text-danger small mt-1">{errors.roles}</div>
        )}
      </fieldset>
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
      <button type="submit" className="btn btn-primary mr-2" disabled={busy}>
        {busy ? t('common.saving') : t('common.save')}
      </button>
      <Link to="/admin/users" className="btn btn-secondary">
        {t('common.cancel')}
      </Link>
    </form>
  );
}
