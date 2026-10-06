<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Application\Query\OrderList;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\OrderProduct;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Infrastructure\Persistence\ListMapping;
use App\Shared\Infrastructure\Persistence\ListQueryApplier;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Query\Expr\Join;
use Doctrine\ORM\QueryBuilder;

final class DoctrineOrderRepository implements OrderRepository, OrderList
{
    /** A customer's full name, as the list shows it (an order without a customer has none). */
    private const CUSTOMER_NAME = "CONCAT(COALESCE(cu.firstName, ''), ' ', COALESCE(cu.lastName, ''))";

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ListQueryApplier $lists,
    ) {
    }

    public function get(int $id): Order
    {
        return $this->em->find(Order::class, $id) ?? throw new OrderNotFound();
    }

    public function add(Order $order): void
    {
        $this->em->persist($order);
    }

    public function identify(Order $order): int
    {
        $this->em->persist($order);
        $this->em->flush();

        return (int) $order->getId();
    }

    public function addComment(Comment $comment): void
    {
        $this->em->persist($comment);
    }

    public function remove(Order $order): void
    {
        $this->em->remove($order);
    }

    public function removeLine(OrderProduct $line): void
    {
        $this->em->remove($line);
    }

    public function removeComment(Comment $comment): void
    {
        $this->em->remove($comment);
    }

    public function ofWarehouse(int $warehouseId): array
    {
        // The legacy list inner-joined the customer, hiding orders without one: a left join now (decision 9).
        /** @var list<Order> $orders */
        $orders = $this->em->createQueryBuilder()
            ->select('o', 'cu', 'co', 'w')
            ->from(Order::class, 'o')
            ->leftJoin('o.customer', 'cu')
            ->leftJoin('o.comments', 'co')
            ->innerJoin('o.warehouse', 'w')
            ->where('w.id = :warehouse')
            ->setParameter('warehouse', $warehouseId)
            ->orderBy('o.id', \SortDirection::Descending)
            ->getQuery()
            ->getResult();

        return $orders;
    }

    public function page(int $warehouseId, ListQuery $query): ListPage
    {
        $mapping = $this->mapping();
        $page = $this->lists->page(
            $this->ofWarehouseQuery($warehouseId)->addSelect('co')->leftJoin('o.comments', 'co'),
            $query,
            $mapping,
        );

        $facets = $page->facets;
        if (\in_array('source', $query->facets, true)) {
            $facets['source'] = $this->sourceFacet($warehouseId, $query, $mapping);
        }
        if (\in_array('pinned', $query->facets, true)) {
            $pinned = $this->count($warehouseId, $query->without('pinned'), $mapping, ['pinned' => new AnyOfFilter(['1'])]);
            $facets['pinned'] = 0 === $pinned ? [] : [['value' => '1', 'count' => $pinned]];
        }

        /** @var list<Order> $orders */
        $orders = $page->items;

        return new ListPage($orders, $page->total, $facets);
    }

    /**
     * The warehouse's orders (partial shipments have none) with their warehouse and customer: what every list query
     * starts from. The customer is a left join: the legacy list's inner join hid orders without one (decision 9).
     */
    private function ofWarehouseQuery(int $warehouseId): QueryBuilder
    {
        return $this->em->createQueryBuilder()
            ->select('o', 'cu', 'w')
            ->from(Order::class, 'o')
            ->innerJoin('o.warehouse', 'w')
            ->leftJoin('o.customer', 'cu')
            ->where('w.id = :warehouse')
            ->setParameter('warehouse', $warehouseId);
    }

    /**
     * The orders list's columns (OrderController::listSchema()): `customer` is the name or the email, `source` and
     * `pinned` are conditions of their own (the shop link and the pinned comment live in shops-settings' tables).
     */
    private function mapping(): ListMapping
    {
        return new ListMapping(
            id: 'o.id',
            columns: [
                'code' => 'o.code',
                'customer' => [self::CUSTOMER_NAME, 'cu.email'],
                'status' => 'o.status',
                'source' => $this->sourceCondition(...),
                'created_at' => 'o.createdAt',
                'pinned' => $this->pinnedCondition(...),
            ],
            search: ['o.code', self::CUSTOMER_NAME, 'cu.email'],
            sorts: ['customer' => self::CUSTOMER_NAME],
        );
    }

    /**
     * phone: a phone order; web: a web order no connection brought; shop:<id>: an order that connection brought
     * (docs/pdr/prd-shops-settings.md, Decisions 9).
     */
    private function sourceCondition(QueryBuilder $qb, ListFilter $filter, string $param): ?string
    {
        \assert($filter instanceof AnyOfFilter);
        $linked = static fn (string $alias, string $where = ''): string => \sprintf('EXISTS (SELECT IDENTITY(%1$s.order) FROM %2$s %1$s WHERE %1$s.order = o%3$s)', $alias, ShopOrderLink::class, $where);
        $conditions = [];
        $shops = [];
        foreach ($filter->values as $value) {
            if (str_starts_with($value, 'shop:')) {
                $shops[] = (int) substr($value, 5);
            } elseif ('phone' === $value) {
                $conditions[] = \sprintf('(o.source = :%1$sphone AND NOT %2$s)', $param, $linked($param.'p'));
                $qb->setParameter($param.'phone', Order::SOURCE_PHONE);
            } elseif ('web' === $value) {
                $conditions[] = \sprintf('((o.source IS NULL OR o.source <> :%1$sphone) AND NOT %2$s)', $param, $linked($param.'w'));
                $qb->setParameter($param.'phone', Order::SOURCE_PHONE);
            }
        }
        if ([] !== $shops) {
            $conditions[] = $linked($param.'s', \sprintf(' AND IDENTITY(%1$ss.connection) IN (:%1$sshops)', $param));
            $qb->setParameter($param.'shops', $shops);
        }

        return [] === $conditions ? null : '('.implode(' OR ', $conditions).')';
    }

    /** 1: the order has a pinned comment. */
    private function pinnedCondition(QueryBuilder $qb, ListFilter $filter, string $param): string
    {
        return \sprintf(
            'EXISTS (SELECT IDENTITY(%1$sm.comment) FROM %2$s %1$sm JOIN %1$sm.comment %1$sc WHERE %1$sc.order = o AND %1$sm.pinned = true)',
            $param,
            OrderCommentMeta::class,
        );
    }

    /**
     * The source counts over every filter but the source: one GROUP BY on the order's source and its shop link.
     *
     * @return list<array{value: string, count: int}>
     */
    private function sourceFacet(int $warehouseId, ListQuery $query, ListMapping $mapping): array
    {
        $qb = $this->ofWarehouseQuery($warehouseId);
        $this->lists->apply($qb, $query->without('source'), $mapping);
        /** @var list<array{shop: int|string|null, source: int|string|null, n: int|string}> $rows */
        $rows = $qb->resetDQLPart('orderBy')
            ->select('IDENTITY(fl.connection) AS shop', 'o.source AS source', 'COUNT(DISTINCT o.id) AS n')
            ->leftJoin(ShopOrderLink::class, 'fl', Join::WITH, 'fl.order = o')
            ->groupBy('fl.connection')
            ->addGroupBy('o.source')
            ->getQuery()
            ->getArrayResult();

        $counts = [];
        foreach ($rows as $row) {
            $value = null !== $row['shop'] ? 'shop:'.$row['shop'] : (Order::SOURCE_PHONE === (int) $row['source'] ? 'phone' : 'web');
            $counts[$value] = ($counts[$value] ?? 0) + (int) $row['n'];
        }
        ksort($counts, \SORT_NATURAL);

        return array_map(static fn (string|int $value, int $count): array => ['value' => (string) $value, 'count' => $count], array_keys($counts), array_values($counts));
    }

    /**
     * How many of the warehouse's orders the query keeps with these filters added.
     *
     * @param array<string, ListFilter> $filters
     */
    private function count(int $warehouseId, ListQuery $query, ListMapping $mapping, array $filters): int
    {
        $qb = $this->ofWarehouseQuery($warehouseId);
        $this->lists->apply($qb, new ListQuery(1, 0, null, $query->q, $filters + $query->filters, []), $mapping);

        return (int) $qb->resetDQLPart('orderBy')->select('COUNT(DISTINCT o.id)')->getQuery()->getSingleScalarResult();
    }
}
