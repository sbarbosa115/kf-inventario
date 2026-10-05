import {ASSIGNABLE_ROLES} from '@/shared/config';
import type {Translate} from '@/shared/i18n';
import type {User, UserPayload} from '../api/userApi';

export interface UserFormValues {
  name: string;
  username: string;
  email: string;
  password: string;
  roles: string[];
  enabled: boolean;
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

/** The password is typed on the form and never comes back from the API. */
export const MIN_PASSWORD_LENGTH = 6;

export function emptyUserForm(): UserFormValues {
  return {
    name: '',
    username: '',
    email: '',
    password: '',
    roles: [],
    enabled: true,
  };
}

/**
 * Only the roles the form can tick come across: ROLE_USER and the like are reached through them (or were never
 * assignable here), and the API refuses a role outside the nine, as the legacy form's choice list did.
 */
export function userToForm(user: User): UserFormValues {
  return {
    name: user.name,
    username: user.username,
    email: user.email ?? '',
    password: '',
    roles: user.roles.filter((role) =>
      (ASSIGNABLE_ROLES as readonly string[]).includes(role),
    ),
    enabled: user.enabled,
  };
}

/** What can be told before asking the server: a new user needs a password, an edit may leave it blank. */
export function validateUserForm(
  values: UserFormValues,
  isNew: boolean,
  t: Translate,
): UserFormErrors {
  const errors: UserFormErrors = {};
  if (values.name.trim() === '') errors.name = t('users.form.required');
  if (values.username.trim() === '') errors.username = t('users.form.required');
  if (values.email.trim() === '') {
    errors.email = t('users.form.required');
  } else if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = t('users.form.invalidEmail');
  }
  if (values.password === '' && isNew) {
    errors.password = t('users.form.required');
  } else if (
    values.password !== '' &&
    values.password.length < MIN_PASSWORD_LENGTH
  ) {
    errors.password = t('users.form.passwordTooShort', {
      min: MIN_PASSWORD_LENGTH,
    });
  }
  return errors;
}

/** A blank password is left out: on an edit that is how the form says "keep the current one". */
export function userFormToPayload(values: UserFormValues): UserPayload {
  return {
    name: values.name.trim(),
    username: values.username.trim(),
    email: values.email.trim(),
    ...(values.password === '' ? {} : {password: values.password}),
    roles: values.roles,
    enabled: values.enabled,
  };
}

/** The API's violations ({field, message}) as the form's field errors; "roles[2]" belongs to "roles". */
export function violationsToErrors(body: unknown): UserFormErrors {
  const errors: UserFormErrors = {};
  const violations =
    (body as {violations?: {field: string; message: string}[]} | null)
      ?.violations ?? [];
  for (const {field, message} of violations) {
    const name = field.replace(/\[.*$/, '') as keyof UserFormValues;
    errors[name] ??= message;
  }
  return errors;
}
