/** A user's roles as the legacy list showed them: one badge each. */
export function RoleBadges({roles}: {roles: string[]}) {
  return (
    <span>
      {roles.map((role) => (
        <span key={role} className="badge badge-primary mr-1">
          {role}
        </span>
      ))}
    </span>
  );
}
