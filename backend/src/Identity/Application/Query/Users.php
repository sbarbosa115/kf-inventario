<?php

namespace App\Identity\Application\Query;

use App\Identity\Domain\Error\UserNotFound;
use App\Identity\Domain\Model\User;
use App\Identity\Domain\Repository\UserRepository;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * What the Users screen reads. Reads do not go through the command bus.
 */
final class Users
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly UserList $list,
    ) {
    }

    /**
     * A page of users: filtered, sorted and counted in the database.
     *
     * @param list<string> $roles the roles the `roles` facet counts
     *
     * @return ListPage<User>
     */
    public function page(ListQuery $query, array $roles): ListPage
    {
        return $this->list->page($query, $roles);
    }

    /**
     * @throws UserNotFound
     */
    public function get(int $id): User
    {
        return $this->users->get($id);
    }
}
