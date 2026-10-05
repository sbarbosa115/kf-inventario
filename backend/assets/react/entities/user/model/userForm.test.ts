import {translator} from '@/shared/i18n';
import {
  emptyUserForm,
  userFormToPayload,
  userToForm,
  validateUserForm,
  violationsToErrors,
} from './userForm';

const t = translator('en');

describe('the user form model', () => {
  it('requires a password for a new user but not for an edit', () => {
    const values = {
      ...emptyUserForm(),
      name: 'Ana',
      username: 'ana',
      email: 'ana@kf.test',
    };

    expect(validateUserForm(values, true, t).password).toBeDefined();
    expect(validateUserForm(values, false, t)).toEqual({});
  });

  it('refuses a short password and a malformed email', () => {
    const errors = validateUserForm(
      {
        ...emptyUserForm(),
        name: 'A',
        username: 'a',
        email: 'nope',
        password: '123',
      },
      false,
      t,
    );

    expect(Object.keys(errors).sort()).toEqual(['email', 'password']);
  });

  it('leaves a blank password out of what it sends', () => {
    const payload = userFormToPayload({
      ...emptyUserForm(),
      name: ' Ana ',
      username: 'ana',
      email: 'ana@kf.test',
    });

    expect(payload).not.toHaveProperty('password');
    expect(payload.name).toBe('Ana');
  });

  it('fills the form from a user, with the password empty', () => {
    expect(
      userToForm({
        id: 4,
        name: 'Ana',
        username: 'ana',
        email: null,
        roles: ['ROLE_ADMIN'],
        enabled: false,
      }),
    ).toEqual({
      name: 'Ana',
      username: 'ana',
      email: '',
      password: '',
      roles: ['ROLE_ADMIN'],
      enabled: false,
    });
  });

  it('drops the roles the form cannot assign, so saving an old account is not refused', () => {
    const values = userToForm({
      id: 4,
      name: 'Ana',
      username: 'ana',
      email: 'a@kf.test',
      roles: ['ROLE_MANAGE_INVENTORY', 'ROLE_USER', 'ROLE_MANAGE_CUSTOMERS'],
      enabled: true,
    });

    expect(values.roles).toEqual(['ROLE_MANAGE_INVENTORY']);
  });

  it('puts the API violations on their fields', () => {
    expect(
      violationsToErrors({
        violations: [
          {field: 'email', message: 'Bad email.'},
          {field: 'roles[1]', message: 'Bad role.'},
        ],
      }),
    ).toEqual({email: 'Bad email.', roles: 'Bad role.'});
  });
});
