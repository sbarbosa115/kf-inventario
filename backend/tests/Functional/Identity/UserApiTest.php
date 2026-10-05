<?php

namespace App\Tests\Functional\Identity;

use App\Identity\Domain\Model\User;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class UserApiTest extends ApiTestCase
{
    use SignsIn;

    public function testTheListShowsEveryUserByNameWithoutTheirPassword(): void
    {
        $this->aUser(['ROLE_MANAGE_INVENTORY'], 'zed');
        $this->aUser(['ROLE_ADMIN'], 'abe', enabled: false);
        $this->signInAs(['ROLE_MANAGE_USERS', 'ROLE_USER'], 'boss');

        $users = $this->getJson('/api/v1/users');

        $this->assertStatus(200);
        self::assertSame(['Test abe', 'Test boss', 'Test zed'], array_column($users, 'name'), 'Users come in name order.');
        self::assertSame(['id', 'name', 'username', 'email', 'roles', 'enabled'], array_keys($users[0]), 'The shape is the contract; a password never leaves the server.');
        self::assertFalse($users[0]['enabled']);
        self::assertSame(['ROLE_ADMIN'], $users[0]['roles']);
    }

    public function testOneUserCanBeReadAndAnUnknownOneIs404(): void
    {
        $user = $this->aUser(['ROLE_UPDATE_ORDERS'], 'ana');
        $this->signInAs(['ROLE_MANAGE_USERS']);

        $found = $this->getJson('/api/v1/users/'.$user->getId());
        $this->assertStatus(200);
        self::assertSame('ana', $found['username']);
        self::assertSame(['ROLE_UPDATE_ORDERS'], $found['roles'], 'The roles assigned, not the ones reached through the hierarchy.');

        $missing = $this->getJson('/api/v1/users/999999');
        $this->assertStatus(404);
        self::assertSame('user_not_found', $missing['error']);
    }

    public function testCreatingAUserStoresAHashAndTheyCanSignIn(): void
    {
        $this->signInAs(['ROLE_MANAGE_USERS']);

        $created = $this->sendJson('POST', '/api/v1/users', [
            'name' => 'Nina Lopez',
            'username' => 'nina',
            'email' => 'nina@kf.test',
            'password' => 'first-pass',
            'roles' => ['ROLE_MANAGE_ORDERS', 'ROLE_CAN_READ_INVOICES'],
            'enabled' => true,
        ]);

        $this->assertStatus(201);
        self::assertSame('nina', $created['username']);
        self::assertSame(['ROLE_MANAGE_ORDERS', 'ROLE_CAN_READ_INVOICES'], $created['roles']);
        $stored = $this->em()->getRepository(User::class)->findOneBy(['username' => 'nina']);
        self::assertNotNull($stored);
        self::assertNotSame('first-pass', $stored->getPassword(), 'The password is stored hashed.');
        self::assertTrue(static::getContainer()->get(UserPasswordHasherInterface::class)->isPasswordValid($stored, 'first-pass'));
        self::assertStringStartsWith('$2y$', (string) $stored->getPassword(), 'Same bcrypt as the existing accounts.');

        $this->client->getCookieJar()->clear();
        $this->sendJson('POST', '/api/v1/auth/login', ['username' => 'nina', 'password' => 'first-pass']);
        $this->assertStatus(200, 'The new account signs in.');
    }

    public function testANewUserNeedsEveryField(): void
    {
        $this->signInAs(['ROLE_MANAGE_USERS']);

        $body = $this->sendJson('POST', '/api/v1/users', ['name' => '', 'username' => 'x', 'email' => 'not-an-email', 'password' => 'abc', 'roles' => []]);

        $this->assertStatus(422);
        self::assertSame('validation_failed', $body['error']);
        $fields = array_column($body['violations'], 'field');
        foreach (['name', 'email', 'password'] as $field) {
            self::assertContains($field, $fields, "{$field} is refused.");
        }
        self::assertNull($this->em()->getRepository(User::class)->findOneBy(['username' => 'x']));
    }

    public function testANewUserWithoutAPasswordIsRefusedEvenWhenItIsBlank(): void
    {
        $this->signInAs(['ROLE_MANAGE_USERS']);

        foreach ([null, ''] as $blank) {
            $body = $this->sendJson('POST', '/api/v1/users', ['name' => 'N', 'username' => 'n', 'email' => 'n@kf.test', 'password' => $blank, 'roles' => []]);

            $this->assertStatus(422, 'Only an edit may leave the password blank.');
            self::assertSame('password', $body['violations'][0]['field']);
        }
        self::assertNull($this->em()->getRepository(User::class)->findOneBy(['username' => 'n']));
    }

    public function testARoleOutsideTheNineTheScreenAssignsIsRefused(): void
    {
        $this->signInAs(['ROLE_MANAGE_USERS']);

        $body = $this->sendJson('POST', '/api/v1/users', ['name' => 'N', 'username' => 'n', 'email' => 'n@kf.test', 'password' => 'secret1', 'roles' => ['ROLE_SUPER_ADMIN']]);

        $this->assertStatus(422);
        self::assertSame('validation_failed', $body['error']);
        self::assertStringStartsWith('roles', $body['violations'][0]['field']);
    }

    public function testEditingChangesTheFieldsAndANewPasswordReplacesTheHash(): void
    {
        $user = $this->aUser(['ROLE_MANAGE_INVENTORY'], 'ana', 'old-pass');
        $oldHash = $user->getPassword();
        $this->signInAs(['ROLE_MANAGE_USERS']);

        $updated = $this->sendJson('PUT', '/api/v1/users/'.$user->getId(), [
            'name' => 'Ana Maria', 'username' => 'ana', 'email' => 'ana@kf.test', 'password' => 'brand-new', 'roles' => ['ROLE_MANAGE_ORDERS'], 'enabled' => false,
        ]);

        $this->assertStatus(200);
        self::assertSame('Ana Maria', $updated['name']);
        self::assertSame(['ROLE_MANAGE_ORDERS'], $updated['roles']);
        self::assertFalse($updated['enabled']);
        $stored = $this->em()->find(User::class, $user->getId());
        self::assertNotSame($oldHash, $stored->getPassword());
        self::assertTrue(static::getContainer()->get(UserPasswordHasherInterface::class)->isPasswordValid($stored, 'brand-new'));
    }

    public function testABlankPasswordOnEditKeepsTheHash(): void
    {
        $user = $this->aUser(['ROLE_MANAGE_INVENTORY'], 'ana', 'old-pass');
        $hash = $user->getPassword();
        $this->signInAs(['ROLE_MANAGE_USERS']);

        foreach (['', null] as $blank) {
            $this->sendJson('PUT', '/api/v1/users/'.$user->getId(), ['name' => 'Ana', 'username' => 'ana', 'email' => 'ana@kf.test', 'password' => $blank, 'roles' => [], 'enabled' => true]);
            $this->assertStatus(200, 'A blank password is not an error on edit.');
            $this->em()->clear();
            self::assertSame($hash, $this->em()->find(User::class, $user->getId())->getPassword(), 'The hash is untouched.');
        }
        $this->sendJson('PUT', '/api/v1/users/'.$user->getId(), ['name' => 'Ana', 'username' => 'ana', 'email' => 'ana@kf.test', 'roles' => [], 'enabled' => true]);
        $this->assertStatus(200, 'Leaving the field out is the same.');
    }

    public function testEditingAnUnknownUserIs404(): void
    {
        $this->signInAs(['ROLE_MANAGE_USERS']);

        $body = $this->sendJson('PUT', '/api/v1/users/999999', ['name' => 'A', 'username' => 'a', 'email' => 'a@kf.test', 'roles' => []]);

        $this->assertStatus(404);
        self::assertSame('user_not_found', $body['error']);
    }

    public function testSomeoneWithoutManageUsersCannotUseAnyOfIt(): void
    {
        $user = $this->signInAs(['ROLE_USER']);
        $valid = ['name' => 'A', 'username' => 'a', 'email' => 'a@kf.test', 'password' => 'secret1', 'roles' => []];

        $this->getJson('/api/v1/users');
        $this->assertStatus(403, 'The list is for ROLE_MANAGE_USERS.');
        $this->getJson('/api/v1/users/'.$user->getId());
        $this->assertStatus(403);
        $this->sendJson('POST', '/api/v1/users', $valid);
        $this->assertStatus(403);
        $this->sendJson('PUT', '/api/v1/users/'.$user->getId(), $valid);
        $this->assertStatus(403);
        self::assertNull($this->em()->getRepository(User::class)->findOneBy(['username' => 'a']));
    }

    public function testTheOldUserPagesRedirectToTheNewScreens(): void
    {
        $this->signInAs(['ROLE_MANAGE_USERS']);

        foreach (['/admin/user/' => '/admin/users', '/admin/user/new' => '/admin/users/new', '/admin/user/edit/3' => '/admin/users'] as $old => $new) {
            $this->client->request('GET', $old);

            $this->assertStatus(301, "{$old} is a bookmark worth keeping.");
            self::assertSame($new, parse_url((string) $this->client->getResponse()->headers->get('Location'), \PHP_URL_PATH));
        }
    }
}
