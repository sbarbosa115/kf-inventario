<?php

namespace App\Identity\UI\Http\Security;

use App\Identity\Domain\Model\User;
use App\Identity\UI\Http\Output\SessionOutput;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Role\RoleHierarchyInterface;

/**
 * The session answer for a signed-in token, shared by the sign-in handler and GET /api/v1/auth/me.
 */
final class SignedInSession
{
    public function __construct(private readonly RoleHierarchyInterface $roles)
    {
    }

    public function of(TokenInterface $token): SessionOutput
    {
        $user = $token->getUser();
        if (!$user instanceof User) {
            throw new \LogicException('The firewall signs in App\Identity\Domain\Model\User only.');
        }

        return SessionOutput::from($user, array_values(array_unique($this->roles->getReachableRoleNames($token->getRoleNames()))));
    }
}
