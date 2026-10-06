<?php

namespace App\Tests\Functional\Shared;

use App\Identity\Domain\Model\User;
use App\Ordering\Domain\Model\Comment;
use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\DateRangeFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Application\Query\NumberRangeFilter;
use App\Shared\Application\Query\Sort;
use App\Shared\Application\Query\TextFilter;
use App\Shared\Infrastructure\Persistence\ListMapping;
use App\Shared\Infrastructure\Persistence\ListQueryApplier;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * A ListQuery applied to a Doctrine query (docs/pdr/prd-shops-settings.md, "List query contract"): every value is a
 * bound parameter, LIKE wildcards typed by a person match literally, dates are Bogota days with both ends included,
 * facets count each enum value over the other filters. Runs on MySQL (rolled back after each test).
 */
final class ListQueryApplierTest extends KernelTestCase
{
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->em = self::getContainer()->get(EntityManagerInterface::class);
    }

    private function user(string $name, string $username, bool $enabled = true): User
    {
        $user = (new User())->setName($name)->setUsername($username)->setEmail($username.'@kf.test')->setPassword('x')->setRoles([])->setEnabled($enabled);
        $this->em->persist($user);

        return $user;
    }

    private function users(): ListMapping
    {
        return new ListMapping(
            id: 'u.id',
            columns: ['name' => 'u.name', 'username' => 'u.username', 'enabled' => 'u.enabled', 'id' => 'u.id'],
            search: ['u.name', 'u.email'],
            enumValues: ['enabled' => ['yes' => true, 'no' => false]],
        );
    }

    /**
     * @param array<string, ListFilter> $filters
     * @param list<string>              $facets
     */
    private static function query(array $filters = [], ?string $q = null, ?Sort $sort = null, int $page = 1, int $perPage = 25, array $facets = []): ListQuery
    {
        return new ListQuery($page, $perPage, $sort ?? new Sort('name', false), $q, $filters, $facets);
    }

    /**
     * @return list<string>
     */
    private function names(ListQuery $query): array
    {
        $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u')->where('u.username LIKE :prefix')->setParameter('prefix', 'lqa-%');
        $result = (new ListQueryApplier())->page($qb, $query, $this->users());

        return array_map(static fn (User $u): string => (string) $u->getName(), $result->items);
    }

    public function testTypedWildcardsMatchLiterallyThroughBoundParameters(): void
    {
        $this->user('Ana 50% off', 'lqa-1');
        $this->user('Ana 500 off', 'lqa-2');
        $this->user('Bob_x', 'lqa-3');
        $this->user('Bobax', 'lqa-4');
        $this->em->flush();

        self::assertSame(['Ana 50% off'], $this->names(self::query(['name' => new TextFilter('50%')])), '% is not a wildcard.');
        self::assertSame(['Bob_x'], $this->names(self::query(['name' => new TextFilter('b_x')])), '_ is not a wildcard; matching ignores case.');

        $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u');
        (new ListQueryApplier())->apply($qb, self::query(['name' => new TextFilter("50%' OR 1=1 --")]), $this->users());
        self::assertStringNotContainsString('50%', $qb->getDQL(), 'The value is never written into the query.');
        self::assertContains('%50\\%\' or 1=1 --%', array_map(static fn ($p) => $p->getValue(), $qb->getParameters()->toArray()));
    }

    public function testQSearchesAnyOfTheSearchColumns(): void
    {
        $this->user('Carla', 'lqa-carla');
        $this->user('Dora', 'lqa-dora');
        $this->em->flush();

        self::assertSame(['Carla'], $this->names(self::query(q: 'carla@kf')), 'The email is a search column.');
        self::assertSame(['Dora'], $this->names(self::query(q: 'DOR')));
    }

    public function testAnEnumFilterKeepsAnyOfItsValuesAndFacetsCountOverTheOtherFilters(): void
    {
        $this->user('Eva', 'lqa-eva', true);
        $this->user('Eli', 'lqa-eli', false);
        $this->user('Fede', 'lqa-fede', false);
        $this->em->flush();

        self::assertSame(['Eli', 'Fede'], $this->names(self::query(['enabled' => new AnyOfFilter(['no'])])));
        self::assertSame(['Eli', 'Eva', 'Fede'], $this->names(self::query(['enabled' => new AnyOfFilter(['no', 'yes'])])));

        $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u')->where('u.username LIKE :prefix')->setParameter('prefix', 'lqa-%');
        $result = (new ListQueryApplier())->page($qb, self::query(['enabled' => new AnyOfFilter(['no']), 'name' => new TextFilter('e')], facets: ['enabled']), $this->users());

        self::assertSame(2, $result->total);
        self::assertSame(
            ['enabled' => [['value' => 'no', 'count' => 2], ['value' => 'yes', 'count' => 1]]],
            $result->facets,
            'A facet ignores its own filter (every value keeps its count) but not the others.',
        );
    }

    public function testNumberRangesIncludeBothEnds(): void
    {
        $users = [$this->user('G1', 'lqa-g1'), $this->user('G2', 'lqa-g2'), $this->user('G3', 'lqa-g3')];
        $this->em->flush();
        $ids = array_map(static fn (User $u): int => (int) $u->getId(), $users);

        self::assertSame(['G1', 'G2'], $this->names(self::query(['id' => new NumberRangeFilter((string) $ids[0], (string) $ids[1])])));
        self::assertSame(['G3'], $this->names(self::query(['id' => new NumberRangeFilter((string) $ids[2], null)])));
    }

    public function testSortPagesAndTotal(): void
    {
        foreach (['Hugo', 'Ines', 'Juan', 'Kim', 'Luz'] as $i => $name) {
            $this->user($name, 'lqa-s'.$i);
        }
        $this->em->flush();

        self::assertSame(['Luz', 'Kim'], $this->names(self::query(sort: new Sort('name', true), perPage: 2)));
        self::assertSame(['Juan', 'Ines'], $this->names(self::query(sort: new Sort('name', true), page: 2, perPage: 2)));

        $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u')->where('u.username LIKE :prefix')->setParameter('prefix', 'lqa-%');
        $result = (new ListQueryApplier())->page($qb, self::query(perPage: 2), $this->users());
        self::assertSame(5, $result->total, 'The total counts every row the filters keep, not the page.');
        self::assertCount(2, $result->items);
    }

    public function testEveryRowAtOnceWhenPerPageIsZero(): void
    {
        foreach (['M1', 'M2', 'M3'] as $i => $name) {
            $this->user($name, 'lqa-m'.$i);
        }
        $this->em->flush();

        self::assertSame(['M1', 'M2', 'M3'], $this->names(self::query(perPage: 0)));
    }

    public function testDateRangesAreBogotaDaysWithBothEndsIncluded(): void
    {
        $bogota = new \DateTimeZone('America/Bogota');
        foreach (['2026-09-30 23:59:59' => 'before', '2026-10-01 00:00:00' => 'first', '2026-10-06 23:59:59' => 'last', '2026-10-07 00:00:00' => 'after'] as $at => $content) {
            $comment = (new Comment())->setContent('lqa '.$content)->setCreatedAt(new \DateTime($at, $bogota));
            $this->em->persist($comment);
        }
        $this->em->flush();

        $qb = $this->em->createQueryBuilder()->select('c')->from(Comment::class, 'c')->where('c.content LIKE :prefix')->setParameter('prefix', 'lqa %');
        $mapping = new ListMapping(id: 'c.id', columns: ['created_at' => 'c.createdAt', 'content' => 'c.content']);
        $range = new DateRangeFilter(new \DateTimeImmutable('2026-10-01', $bogota), new \DateTimeImmutable('2026-10-06', $bogota));
        $result = (new ListQueryApplier())->page($qb, new ListQuery(1, 25, new Sort('content', false), null, ['created_at' => $range], []), $mapping);

        self::assertSame(['lqa first', 'lqa last'], array_map(static fn (Comment $c): string => (string) $c->getContent(), $result->items));
    }

    public function testAColumnOfSeveralExpressionsMatchesAnyOfThem(): void
    {
        $this->user('Nora', 'lqa-nora');
        $this->user('Olga', 'lqa-olga');
        $this->em->flush();

        $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u')->where('u.username LIKE :prefix')->setParameter('prefix', 'lqa-%');
        $mapping = new ListMapping(id: 'u.id', columns: ['who' => ['u.name', 'u.email']]);
        $result = (new ListQueryApplier())->page($qb, self::query(['who' => new TextFilter('olga@')]), $mapping);

        self::assertSame(['Olga'], array_map(static fn (User $u): string => (string) $u->getName(), $result->items), 'The email matched although the name did not.');
    }

    public function testAClosureColumnWritesItsOwnConditionAndLeavesItsFacetToTheList(): void
    {
        $this->user('Pia', 'lqa-pia', true);
        $this->user('Quim', 'lqa-quim', false);
        $this->em->flush();

        $seen = [];
        $active = static function (QueryBuilder $qb, ListFilter $filter, string $param) use (&$seen): ?string {
            \assert($filter instanceof AnyOfFilter);
            $seen[] = $param;
            if (['on', 'off'] === $filter->values) {
                return null;
            }
            $qb->setParameter($param, 'on' === $filter->values[0]);

            return "u.enabled = :{$param}";
        };
        $mapping = new ListMapping(id: 'u.id', columns: ['name' => 'u.name', 'active' => $active]);
        $page = function (ListQuery $query) use ($mapping): array {
            $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u')->where('u.username LIKE :prefix')->setParameter('prefix', 'lqa-%');
            $result = (new ListQueryApplier())->page($qb, $query, $mapping);

            return [array_map(static fn (User $u): string => (string) $u->getName(), $result->items), $result->facets];
        };

        self::assertSame([['Quim'], ['active' => []]], $page(self::query(['active' => new AnyOfFilter(['off'])], facets: ['active'])), 'A closure column has no GROUP BY facet: the list answers it.');
        self::assertSame(['Pia', 'Quim'], $page(self::query(['active' => new AnyOfFilter(['on', 'off'])]))[0], 'null: no condition.');
        self::assertSame(['lq1', 'lq1'], $seen, 'The closure is handed a parameter name to bind its value under (once per query: not for a facet).');
    }

    public function testWithoutASortTheNewestRowComesFirst(): void
    {
        foreach (['R1', 'R2', 'R3'] as $i => $name) {
            $this->user($name, 'lqa-r'.$i);
        }
        $this->em->flush();

        $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u')->where('u.username LIKE :prefix')->setParameter('prefix', 'lqa-%');
        $result = (new ListQueryApplier())->page($qb, new ListQuery(1, 25, null, null, [], []), $this->users());

        self::assertSame(['R3', 'R2', 'R1'], array_map(static fn (User $u): string => (string) $u->getName(), $result->items));
    }

    public function testASortHasAnExpressionOfItsOwnOrItsColumnElseTheNewestComeFirst(): void
    {
        foreach (['S2', 'S1'] as $i => $name) {
            $this->user($name, 'lqa-t'.$i);
        }
        $this->em->flush();

        $qb = $this->em->createQueryBuilder()->select('u')->from(User::class, 'u')->where('u.username LIKE :prefix')->setParameter('prefix', 'lqa-%');
        $mapping = new ListMapping(id: 'u.id', columns: ['name' => 'u.name', 'flag' => static fn (): ?string => null], sorts: ['id' => 'u.id']);
        $applier = new ListQueryApplier();

        self::assertSame(['S1', 'S2'], array_map(static fn (User $u): string => (string) $u->getName(), $applier->page(clone $qb, self::query(sort: new Sort('id', true)), $mapping)->items), 'A sort expression of its own (customers: -id).');
        self::assertSame(['S2', 'S1'], array_map(static fn (User $u): string => (string) $u->getName(), $applier->page(clone $qb, self::query(sort: new Sort('name', true)), $mapping)->items), 'A column is its own sort.');
        self::assertSame(['S1', 'S2'], array_map(static fn (User $u): string => (string) $u->getName(), $applier->page(clone $qb, self::query(sort: new Sort('flag', false)), $mapping)->items), 'A closure column has no sort expression: newest first.');
    }
}
