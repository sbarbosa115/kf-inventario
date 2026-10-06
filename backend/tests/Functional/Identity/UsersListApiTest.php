<?php

namespace App\Tests\Functional\Identity;

use App\Identity\Domain\Model\User;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * GET /api/v1/users in SQL (docs/pdr/prd-shops-settings.md, "List query contract", item 1): users filtered by name,
 * username, email, roles (any of the nine the screen assigns) and enabled, sorted by name, paged, with the roles and
 * enabled counts.
 */
final class UsersListApiTest extends ApiTestCase
{
    use SignsIn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_MANAGE_USERS', 'ROLE_USER'], 'lstadmin');
        $this->user('Ana Admin', 'lst-ana', ['ROLE_ADMIN']);
        $this->user('Bruno Stock', 'lst-bruno', ['ROLE_MANAGE_INVENTORY', 'ROLE_USER']);
        $this->user('Carla Both', 'lst-carla', ['ROLE_MANAGE_INVENTORY', 'ROLE_MANAGE_USERS', 'ROLE_USER'], false);
        $this->user('Dario 100%', 'lst_dario', ['ROLE_CAN_READ_INVOICES', 'ROLE_USER']);
        $this->em()->clear();
    }

    /**
     * @param list<string> $roles
     */
    private function user(string $name, string $username, array $roles, bool $enabled = true): void
    {
        $user = (new User())->setName($name)->setUsername($username)->setEmail($username.'@users.test')->setPassword('x')->setRoles($roles)->setEnabled($enabled);
        $this->em()->persist($user);
        $this->em()->flush();
    }

    /**
     * @return array<mixed>
     */
    private function list(string $query): array
    {
        $body = $this->getJson('/api/v1/users?'.$query);
        $this->assertStatus(200, $query);

        return $body;
    }

    /**
     * @return list<string> the usernames, among the four this test made
     */
    private function usernames(string $query = ''): array
    {
        return array_column($this->list('filter[email]=%40users.test&'.$query)['items'], 'username');
    }

    public function testByNameWithTheirRolesAndState(): void
    {
        $body = $this->list('filter[email]=%40users.test');

        self::assertSame(['lst-ana', 'lst-bruno', 'lst-carla', 'lst_dario'], array_column($body['items'], 'username'), 'By name.');
        self::assertSame(['ROLE_MANAGE_INVENTORY', 'ROLE_MANAGE_USERS', 'ROLE_USER'], $body['items'][2]['roles']);
        self::assertFalse($body['items'][2]['enabled']);
        self::assertArrayNotHasKey('password', $body['items'][0], 'Never the password.');
    }

    public function testTheRolesFilterKeepsAnyOfTheRoles(): void
    {
        self::assertSame(['lst-ana'], $this->usernames('filter[roles][]=ROLE_ADMIN'));
        self::assertSame(['lst-bruno', 'lst-carla'], $this->usernames('filter[roles][]=ROLE_MANAGE_INVENTORY'));
        self::assertSame(['lst-ana', 'lst-carla'], $this->usernames('filter[roles][]=ROLE_ADMIN&filter[roles][]=ROLE_MANAGE_USERS'), 'Any of them.');
        self::assertSame([], $this->usernames('filter[roles][]=ROLE_UPDATE_ORDERS'));

        $body = $this->getJson('/api/v1/users?filter[roles][]=ROLE_USER');
        $this->assertStatus(422, 'Only the nine roles the screen assigns.');
        self::assertSame(['filter.roles'], array_column($body['violations'], 'field'));
        $this->getJson('/api/v1/users?filter[roles][]=ROLE_%25');
        $this->assertStatus(422, 'A pattern is not a role.');
    }

    public function testTheRolesAndEnabledFacetsCountOverTheOtherFilters(): void
    {
        $body = $this->list('filter[email]=%40users.test&filter[enabled][]=yes&filter[roles][]=ROLE_MANAGE_INVENTORY&facets=roles,enabled');

        self::assertSame(1, $body['total']);
        self::assertSame(
            [['value' => 'ROLE_ADMIN', 'count' => 1], ['value' => 'ROLE_CAN_READ_INVOICES', 'count' => 1], ['value' => 'ROLE_MANAGE_INVENTORY', 'count' => 1]],
            $body['facets']['roles'],
            'The enabled users per role (Carla is disabled); ROLE_USER is not one of the nine; the roles filter does not narrow its own counts.',
        );
        self::assertSame([['value' => 'no', 'count' => 1], ['value' => 'yes', 'count' => 1]], $body['facets']['enabled'], 'The inventory users, enabled or not.');
    }

    public function testEnabledTextFiltersAndQ(): void
    {
        self::assertSame(['lst-carla'], $this->usernames('filter[enabled][]=no'));
        self::assertSame(['lst-ana', 'lst-bruno', 'lst_dario'], $this->usernames('filter[enabled][]=yes'));
        self::assertSame(['lst-bruno'], $this->usernames('filter[name]=STOCK'));
        self::assertSame(['lst_dario'], $this->usernames('filter[username]=lst_'), '_ is not a wildcard.');
        self::assertSame(['lst_dario'], $this->usernames('filter[name]=100%25'), '% is not a wildcard.');
        self::assertSame(['lst-carla'], $this->usernames('q=carla'), 'q: name, username, email.');
        self::assertSame(['lst-ana'], $this->usernames('q=lst-ana%40'));
    }

    public function testSortsAndPages(): void
    {
        self::assertSame(['lst_dario', 'lst-carla', 'lst-bruno', 'lst-ana'], $this->usernames('sort=-name'));
        self::assertSame(['lst-carla'], $this->usernames('filter[username]=lst-&sort=email&per_page=2&page=2'), 'The database\'s collation orders the punctuation: the test avoids it.');
        $page = $this->list('filter[email]=%40users.test&per_page=3');
        self::assertSame(4, $page['total']);
        self::assertCount(3, $page['items']);

        $this->getJson('/api/v1/users?sort=roles');
        $this->assertStatus(422);
    }
}
