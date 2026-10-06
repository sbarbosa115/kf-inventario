<?php

namespace App\Tests\Support;

use App\Identity\Domain\Model\User;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Users for a test: saved with the roles the test needs, and signed in through the session as the app does.
 *
 * @phpstan-require-extends ApiTestCase
 */
trait SignsIn
{
    /**
     * @param list<string> $roles
     */
    protected function aUser(array $roles = ['ROLE_USER'], string $username = 'tester', string $password = 'secret-pass', bool $enabled = true): User
    {
        $user = new User();
        $user->setName('Test '.$username);
        $user->setUsername($username);
        $user->setEmail($username.'@kf.test');
        $user->setRoles($roles);
        $user->setEnabled($enabled);
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $user->setPassword($hasher->hashPassword($user, $password));
        $this->em()->persist($user);
        $this->em()->flush();

        return $user;
    }

    /**
     * @param list<string> $roles
     */
    protected function signInAs(array $roles = ['ROLE_USER'], string $username = 'tester'): User
    {
        $user = $this->aUser($roles, $username);
        $this->client->loginUser($user);

        return $user;
    }
}
