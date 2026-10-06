import {ASSIGNABLE_ROLES} from '@/shared/config';
import en from '@/shared/i18n/locales/en/roles.json';
import es from '@/shared/i18n/locales/es/roles.json';
import {isNamedRole, ROLE_GROUPS, roleTone, visibleRoles} from './roles';

describe('the roles of the Users screen', () => {
  it('puts every assignable role in exactly one group', () => {
    const grouped = ROLE_GROUPS.flatMap((group) => [...group.roles]);
    expect([...grouped].sort()).toEqual([...ASSIGNABLE_ROLES].sort());
  });

  it('groups them as Warehouse, Sales, Invoices, Admin', () => {
    expect(ROLE_GROUPS.map((group) => group.key)).toEqual([
      'warehouse',
      'sales',
      'invoices',
      'admin',
    ]);
  });

  it.each([
    ['en', en],
    ['es', es],
  ])(
    'has a plain name and a description in %s for every assignable role',
    (_language, catalogue) => {
      for (const role of ASSIGNABLE_ROLES) {
        const names = catalogue.names as Record<string, string>;
        const descriptions = catalogue.descriptions as Record<string, string>;
        expect(names[role], `${role} needs a name`).toBeTruthy();
        expect(descriptions[role], `${role} needs a description`).toBeTruthy();
        expect(names[role]).not.toContain('ROLE_');
      }
    },
  );

  it('hides ROLE_USER, orders the rest as the form does and keeps an unknown role as it is', () => {
    expect(
      visibleRoles(['ROLE_USER', 'ROLE_MANAGE_USERS', 'ROLE_ADMIN', 'ROLE_X']),
    ).toEqual(['ROLE_ADMIN', 'ROLE_MANAGE_USERS', 'ROLE_X']);
    expect(isNamedRole('ROLE_MANAGE_CUSTOMERS')).toBe(true);
    expect(isNamedRole('ROLE_X')).toBe(false);
  });

  it('gives Admin the accent and the invoice roles the info tone', () => {
    expect(roleTone('ROLE_ADMIN')).toBe('accent');
    expect(roleTone('ROLE_CAN_READ_INVOICES')).toBe('info');
    expect(roleTone('ROLE_MANAGE_ORDERS')).toBe('neutral');
  });
});
