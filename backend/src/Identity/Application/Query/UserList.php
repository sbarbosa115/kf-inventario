<?php

namespace App\Identity\Application\Query;

use App\Identity\Domain\Model\User;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * The users list in the database (docs/pdr/prd-shops-settings.md, "List query contract"): filtered, sorted and paged
 * by the query, with the facet counts it asks for.
 */
interface UserList
{
    /**
     * @param list<string> $roles the roles the `roles` facet counts (the ones the screen assigns)
     *
     * @return ListPage<User>
     */
    public function page(ListQuery $query, array $roles): ListPage;
}
