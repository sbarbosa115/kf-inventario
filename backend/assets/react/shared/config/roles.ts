/**
 * The roles the Users screen assigns, in the order the legacy form listed them (UserType). Other roles exist
 * (ROLE_MANAGE_CUSTOMERS, the ROLE_CAN_* ones) but are reached through these by the role hierarchy.
 */
export const ASSIGNABLE_ROLES = [
  'ROLE_ADMIN',
  'ROLE_MANAGE_INVENTORY',
  'ROLE_MANAGE_ORDERS',
  'ROLE_UPDATE_ORDERS',
  'ROLE_UPDATE_INVOICES',
  'ROLE_CAN_READ_INVOICES',
  'ROLE_CAN_CREATE_INVOICES',
  'ROLE_MANAGE_USERS',
  'ROLE_MANAGE_WAREHOUSES',
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
