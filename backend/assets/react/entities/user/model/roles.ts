import {ASSIGNABLE_ROLES, type AssignableRole} from '@/shared/config';
import type {Tone} from '@/shared/ui';

/**
 * How the form groups the nine assignable roles for a person choosing them. The plain names and the one-line
 * descriptions are in the `roles` catalogue (`roles.names.<ROLE>`, `roles.descriptions.<ROLE>`). Every assignable
 * role is in exactly one group, in the order the form shows them.
 */
export const ROLE_GROUPS: readonly {
  key: 'warehouse' | 'sales' | 'invoices' | 'admin';
  roles: readonly AssignableRole[];
}[] = [
  {
    key: 'warehouse',
    roles: ['ROLE_MANAGE_INVENTORY', 'ROLE_MANAGE_WAREHOUSES'],
  },
  {key: 'sales', roles: ['ROLE_MANAGE_ORDERS', 'ROLE_UPDATE_ORDERS']},
  {
    key: 'invoices',
    roles: [
      'ROLE_UPDATE_INVOICES',
      'ROLE_CAN_READ_INVOICES',
      'ROLE_CAN_CREATE_INVOICES',
    ],
  },
  {key: 'admin', roles: ['ROLE_ADMIN', 'ROLE_MANAGE_USERS']},
];

/** A role the list names in plain words although the form does not assign it (the hierarchy or a legacy account). */
const DISPLAY_ONLY_ROLES: readonly string[] = ['ROLE_MANAGE_CUSTOMERS'];

/** Every account holds ROLE_USER: a chip for it says nothing. */
const HIDDEN_ROLES: readonly string[] = ['ROLE_USER'];

/** The roles worth a chip on the list, in the order the form lists them; one this screen does not know keeps its constant. */
export function visibleRoles(roles: readonly string[]): string[] {
  const known = [...ASSIGNABLE_ROLES, ...DISPLAY_ONLY_ROLES];
  const rank = (role: string) => {
    const at = known.indexOf(role);
    return at === -1 ? known.length : at;
  };
  return roles
    .filter((role) => !HIDDEN_ROLES.includes(role))
    .sort((a, b) => rank(a) - rank(b));
}

/** Whether a role has a plain name in the catalogue (otherwise the chip shows the constant). */
export function isNamedRole(role: string): boolean {
  return (
    (ASSIGNABLE_ROLES as readonly string[]).includes(role) ||
    DISPLAY_ONLY_ROLES.includes(role)
  );
}

/** Admin stands out; the invoice roles are informational; the rest are plain. */
export function roleTone(role: string): Tone {
  if (role === 'ROLE_ADMIN') return 'accent';
  if (role.includes('INVOICES')) return 'info';
  return 'neutral';
}
