<?php

namespace App\Identity\Infrastructure\Persistence;

use App\Identity\Application\Query\UserList;
use App\Identity\Domain\Model\User;
use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Infrastructure\Persistence\ListMapping;
use App\Shared\Infrastructure\Persistence\ListQueryApplier;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;

final class DoctrineUserList implements UserList
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ListQueryApplier $lists,
    ) {
    }

    public function page(ListQuery $query, array $roles): ListPage
    {
        $page = $this->lists->page($this->users(), $query, self::mapping());

        $facets = $page->facets;
        if (\in_array('roles', $query->facets, true)) {
            $facets['roles'] = $this->rolesFacet($query, $roles);
        }

        /** @var list<User> $users */
        $users = $page->items;

        return new ListPage($users, $page->total, $facets);
    }

    private function users(): QueryBuilder
    {
        return $this->em->createQueryBuilder()->select('u')->from(User::class, 'u');
    }

    /**
     * The users list's columns (UserController::listSchema()). `roles` is a JSON list (the legacy column, LONGTEXT):
     * a role is found by its quoted name, which no other role contains.
     */
    private static function mapping(): ListMapping
    {
        return new ListMapping(
            id: 'u.id',
            columns: [
                'name' => 'u.name',
                'username' => 'u.username',
                'email' => 'u.email',
                'roles' => self::rolesCondition(...),
                'enabled' => 'u.enabled',
            ],
            search: ['u.name', 'u.username', 'u.email'],
            enumValues: ['enabled' => ['yes' => true, 'no' => false]],
        );
    }

    private static function rolesCondition(QueryBuilder $qb, ListFilter $filter, string $param): string
    {
        \assert($filter instanceof AnyOfFilter);
        $conditions = [];
        foreach ($filter->values as $i => $role) {
            $qb->setParameter($param.'_'.$i, self::quoted($role));
            $conditions[] = \sprintf('u.roles LIKE :%s_%d', $param, $i);
        }

        return '('.implode(' OR ', $conditions).')';
    }

    /** `%"ROLE\_ADMIN"%`: the role as the JSON list writes it, its wildcards escaped. */
    private static function quoted(string $role): string
    {
        return '%"'.addcslashes($role, '%_\\').'"%';
    }

    /**
     * How many users hold each role, over every filter but the roles: one query, a sum per role.
     *
     * @param list<string> $roles
     *
     * @return list<array{value: string, count: int}>
     */
    private function rolesFacet(ListQuery $query, array $roles): array
    {
        if ([] === $roles) {
            return [];
        }
        $qb = $this->users();
        $this->lists->apply($qb, $query->without('roles'), self::mapping());
        $qb->resetDQLPart('orderBy')->select('COUNT(u.id) AS total');
        foreach ($roles as $i => $role) {
            $qb->addSelect(\sprintf('SUM(CASE WHEN u.roles LIKE :facet_role_%1$d THEN 1 ELSE 0 END) AS role_%1$d', $i));
            $qb->setParameter('facet_role_'.$i, self::quoted($role));
        }
        /** @var array<string, int|string|null> $sums */
        $sums = $qb->getQuery()->getSingleResult();

        $counts = [];
        foreach ($roles as $i => $role) {
            if ((int) $sums['role_'.$i] > 0) {
                $counts[$role] = (int) $sums['role_'.$i];
            }
        }
        ksort($counts, \SORT_NATURAL);

        return array_map(static fn (string $value, int $count): array => ['value' => $value, 'count' => $count], array_keys($counts), array_values($counts));
    }
}
