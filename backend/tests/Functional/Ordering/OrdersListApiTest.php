<?php

namespace App\Tests\Functional\Ordering;

use App\Customers\Domain\Model\Customer;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * GET /api/v1/orders in SQL (docs/pdr/prd-shops-settings.md, "List query contract", item 1): a warehouse's orders
 * filtered by code, customer, status, source (phone, web, shop:<id>), created day and pinned comment, sorted from the
 * allow-list, paged, with facet counts over the other filters.
 */
final class OrdersListApiTest extends ApiTestCase
{
    use SignsIn;

    private Warehouse $warehouse;
    private ShopConnection $shop;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $em = $this->em();
        $this->warehouse = new Warehouse('Lists', []);
        $elsewhere = new Warehouse('Elsewhere', []);
        $em->persist($this->warehouse);
        $em->persist($elsewhere);
        $this->shop = new ShopConnection('Kfvintage', 'https://kfvintage.test', 'v1:k', 'v1:s', str_repeat('cd', 32), 'v1:w', $this->warehouse, true, true, [], new \DateTimeImmutable());
        $em->persist($this->shop);

        $ana = $this->customer('Ana', 'Diaz', 'ana@lists.test');
        $bea = $this->customer('Bea', 'Zapata', 'bea@lists.test');
        $this->order('LST-0001', Order::STATUS_CREATED, Order::SOURCE_PHONE, '2026-10-01 10:00:00', $ana);
        $this->order('LST-0002', Order::STATUS_PROCESSED, Order::SOURCE_WEB, '2026-10-03 23:59:59', $bea);
        $linked = $this->order('LST-0003', Order::STATUS_PROCESSED, Order::SOURCE_WEB, '2026-10-05 08:00:00', $ana);
        $this->order('LST-0004', Order::STATUS_DELIVERED, Order::SOURCE_PHONE, '2026-09-20 12:00:00', null);
        $this->order('LST-0005', Order::STATUS_PROCESSED, Order::SOURCE_WEB, '2026-10-04 09:00:00', $ana, $elsewhere);
        $em->flush();

        $em->persist(new ShopOrderLink($linked, $this->shop, '5501', 'processing', new \DateTimeImmutable()));
        $comment = (new Comment())->setContent('Call before delivery')->setOrder($linked);
        $em->persist($comment);
        $other = (new Comment())->setContent('Not pinned')->setOrder($linked);
        $em->persist($other);
        $em->flush();
        $meta = new OrderCommentMeta($comment, OrderCommentMeta::ORIGIN_APP);
        $meta->pin(new \DateTimeImmutable(), null);
        $em->persist($meta);
        $em->flush();
        $em->clear();
    }

    private function customer(string $first, string $last, string $email): Customer
    {
        $customer = new Customer();
        $customer->setFirstName($first);
        $customer->setLastName($last);
        $customer->setEmail($email);
        $this->em()->persist($customer);

        return $customer;
    }

    private function order(string $code, int $status, int $source, string $createdAt, ?Customer $customer, ?Warehouse $warehouse = null): Order
    {
        $order = new Order();
        $order->setCode($code);
        $order->setStatus($status);
        $order->setSource($source);
        $order->setPaymentMethod(Order::PAYMENT_CREDIT_CARD);
        $order->setCreatedAt(new \DateTime($createdAt, new \DateTimeZone('America/Bogota')));
        $order->setCustomer($customer);
        $order->setWarehouse($warehouse ?? $this->warehouse);
        $this->em()->persist($order);
        $this->em()->flush();

        return $order;
    }

    /**
     * @return array<mixed>
     */
    private function list(string $query = ''): array
    {
        $body = $this->getJson('/api/v1/orders?warehouse_id='.$this->warehouse->getId().('' === $query ? '' : '&'.$query));
        $this->assertStatus(200, $query);

        return $body;
    }

    /**
     * @return list<string>
     */
    private function codes(string $query = ''): array
    {
        return array_column($this->list($query)['items'], 'code');
    }

    public function testTheWarehouseOrdersComeNewestFirstWithTheirShopAndPinnedComment(): void
    {
        $body = $this->list();

        self::assertSame(['LST-0003', 'LST-0002', 'LST-0001', 'LST-0004'], array_column($body['items'], 'code'), 'Newest first; another warehouse\'s order is not listed.');
        self::assertSame(4, $body['total']);
        self::assertSame(1, $body['page']);
        self::assertSame(25, $body['per_page']);
        self::assertArrayNotHasKey('facets', $body, 'Facets only when asked for.');
        $linked = $body['items'][0];
        self::assertSame(['id' => $this->shop->id(), 'name' => 'Kfvintage', 'takes_notes' => false], $linked['shop']);
        self::assertSame('Call before delivery', $linked['pinned_comment']['content'] ?? null);
        self::assertSame(2, $linked['comments_count'], 'Every comment of the order is counted, not only the pinned one.');
        self::assertSame('Ana', $linked['customer']['first_name']);
        self::assertNull($body['items'][3]['customer'], 'An order without a customer is listed too.');
    }

    public function testStatusSourceShopDateAndPinnedFilters(): void
    {
        self::assertSame(['LST-0003', 'LST-0002'], $this->codes('filter[status][]=2'));
        self::assertSame(['LST-0001', 'LST-0004'], $this->codes('filter[status][]=1&filter[status][]=6'), 'Any of the statuses.');

        self::assertSame(['LST-0001', 'LST-0004'], $this->codes('filter[source][]=phone'));
        self::assertSame(['LST-0002'], $this->codes('filter[source][]=web'), 'Web means a web order no connection brought.');
        self::assertSame(['LST-0003'], $this->codes('filter[source][]=shop:'.$this->shop->id()), "The shop's orders.");
        self::assertSame(['LST-0003', 'LST-0002'], $this->codes('filter[source][]=web&filter[source][]=shop:'.$this->shop->id()));
        self::assertSame([], $this->codes('filter[source][]=shop:999999'), 'A shop with no orders here keeps none.');

        self::assertSame(['LST-0002', 'LST-0001'], $this->codes('filter[created_at][from]=2026-10-01&filter[created_at][to]=2026-10-03'), 'Bogota days, both ends included (23:59:59 on the last one).');
        self::assertSame(['LST-0004'], $this->codes('filter[created_at][to]=2026-09-30'), 'An open start.');
        self::assertSame(['LST-0003'], $this->codes('filter[created_at][from]=2026-10-04'), 'An open end.');

        self::assertSame(['LST-0003'], $this->codes('filter[pinned][]=1'), 'Only the orders with a pinned comment.');

        self::assertSame(['LST-0003', 'LST-0001'], $this->codes('filter[customer]=diaz'), 'The customer by last name.');
        self::assertSame(['LST-0002'], $this->codes('filter[customer]=BEA@LISTS'), 'The customer by email, any case.');
        self::assertSame(['LST-0004'], $this->codes('filter[code]=0004'));
        self::assertSame(['LST-0003'], $this->codes('filter[status][]=2&filter[customer]=ana'), 'Filters add up.');
        self::assertSame(['LST-0003', 'LST-0001'], $this->codes('q=ana'), 'q looks in the code, the customer name and the email.');
        self::assertSame(['LST-0004'], $this->codes('q=lst-0004'));
    }

    public function testFacetsCountEachValueOverTheOtherFilters(): void
    {
        $shop = 'shop:'.$this->shop->id();
        $body = $this->list('filter[status][]=2&facets=status,source,pinned');

        self::assertSame(2, $body['total']);
        self::assertSame(
            [['value' => '1', 'count' => 1], ['value' => '2', 'count' => 2], ['value' => '6', 'count' => 1]],
            $body['facets']['status'],
            'The status counts ignore the status filter itself, so every status keeps its count.',
        );
        self::assertSame([['value' => $shop, 'count' => 1], ['value' => 'web', 'count' => 1]], $body['facets']['source'], 'The sources of the processed orders.');
        self::assertSame([['value' => '1', 'count' => 1]], $body['facets']['pinned']);

        $all = $this->list('facets=source')['facets']['source'];
        self::assertSame([['value' => 'phone', 'count' => 2], ['value' => $shop, 'count' => 1], ['value' => 'web', 'count' => 1]], $all, 'A value with no order has no count.');

        $narrow = $this->list('filter[source][]=phone&facets=source,status');
        self::assertSame($all, $narrow['facets']['source'], 'The source counts ignore the source filter.');
        self::assertSame([['value' => '1', 'count' => 1], ['value' => '6', 'count' => 1]], $narrow['facets']['status']);
    }

    public function testSortsComeFromTheAllowList(): void
    {
        self::assertSame(['LST-0001', 'LST-0002', 'LST-0003', 'LST-0004'], $this->codes('sort=code'));
        self::assertSame(['LST-0004', 'LST-0003', 'LST-0002', 'LST-0001'], $this->codes('sort=-code'));
        self::assertSame(['LST-0004', 'LST-0001', 'LST-0002', 'LST-0003'], $this->codes('sort=created_at'));
        self::assertSame(['LST-0004', 'LST-0003', 'LST-0002', 'LST-0001'], $this->codes('sort=-status'), 'Ties (two processed) newest id first when descending.');
        self::assertSame(['LST-0001', 'LST-0002', 'LST-0003', 'LST-0004'], $this->codes('sort=status'), 'Ties oldest id first when ascending.');
        self::assertSame(['LST-0004', 'LST-0001', 'LST-0003', 'LST-0002'], $this->codes('sort=customer'), 'By customer name (no customer first), ties by id.');
        self::assertSame(['LST-0002', 'LST-0003', 'LST-0001', 'LST-0004'], $this->codes('sort=-customer'));

        foreach (['sort=id', 'sort=-comments_count', 'sort=warehouse'] as $sort) {
            $body = $this->getJson('/api/v1/orders?warehouse_id='.$this->warehouse->getId().'&'.$sort);
            $this->assertStatus(422, $sort.' is not in the allow-list.');
            self::assertSame(['sort'], array_column($body['violations'], 'field'));
        }
    }

    public function testUnknownFieldsAndValuesAreRefused(): void
    {
        foreach ([
            'filter[password]=x' => 'filter.password',
            'filter[status][]=9' => 'filter.status',
            'filter[source][]=shop:abc' => 'filter.source',
            'filter[source][]=email' => 'filter.source',
            'filter[pinned][]=0' => 'filter.pinned',
            'filter[created_at][from]=01/10/2026' => 'filter.created_at',
            'facets=code' => 'facets',
            'per_page=0' => 'per_page',
        ] as $query => $field) {
            $body = $this->getJson('/api/v1/orders?warehouse_id='.$this->warehouse->getId().'&'.$query);
            $this->assertStatus(422, $query);
            self::assertSame('validation_failed', $body['error']);
            self::assertSame([$field], array_column($body['violations'], 'field'), $query);
        }

        $this->getJson('/api/v1/orders');
        $this->assertStatus(422, 'The warehouse stays required.');
    }

    public function testTypedWildcardsMatchThemselves(): void
    {
        $em = $this->em();
        $warehouse = $em->find(Warehouse::class, $this->warehouse->getId());
        self::assertNotNull($warehouse);
        $this->order('50%OFF', Order::STATUS_CREATED, Order::SOURCE_PHONE, '2026-10-02 10:00:00', null, $warehouse);
        $this->order('500OFF', Order::STATUS_CREATED, Order::SOURCE_PHONE, '2026-10-02 11:00:00', null, $warehouse);
        $this->order('A_B', Order::STATUS_CREATED, Order::SOURCE_PHONE, '2026-10-02 12:00:00', null, $warehouse);
        $this->order('AXB', Order::STATUS_CREATED, Order::SOURCE_PHONE, '2026-10-02 13:00:00', null, $warehouse);
        $em->clear();

        self::assertSame(['50%OFF'], $this->codes('filter[code]=50%25'), '% is not a wildcard.');
        self::assertSame(['A_B'], $this->codes('filter[code]=a_b'), '_ is not a wildcard.');
        self::assertSame(['A_B'], $this->codes('q=a_b'), 'Nor in q.');
        self::assertSame([], $this->codes('filter[code]='.rawurlencode("' OR 1=1 --")), 'A quote is text, not SQL.');
    }

    public function testPagesAndTotal(): void
    {
        $second = $this->list('per_page=3&page=2');

        self::assertSame(['LST-0004'], array_column($second['items'], 'code'));
        self::assertSame(4, $second['total'], 'The total counts every order the filters keep, not the page.');
        self::assertSame(2, $second['page']);
        self::assertSame(3, $second['per_page']);
        self::assertSame([], $this->list('per_page=3&page=3')['items'], 'Past the last page: nothing.');
        self::assertSame(['LST-0003', 'LST-0002'], $this->codes('per_page=2'), 'The comments of the first order do not take a row of the page.');
    }

    public function testTheListQueryCountDoesNotGrowWithItsRows(): void
    {
        $few = $this->selectsOfTheList();

        $em = $this->em();
        $warehouse = $em->find(Warehouse::class, $this->warehouse->getId());
        self::assertNotNull($warehouse);
        $customer = $this->customer('Many', 'Rows', 'many@lists.test');
        for ($i = 0; $i < 8; ++$i) {
            $order = $this->order('MANY-'.$i, Order::STATUS_CREATED, Order::SOURCE_PHONE, '2026-10-02 10:00:00', $customer, $warehouse);
            $em->persist((new Comment())->setContent('c'.$i)->setOrder($order));
        }
        $em->flush();
        $em->clear();

        self::assertSame($few, $this->selectsOfTheList(), 'No query per row: customers, comments, shops and pinned comments are read with the page.');
    }

    /**
     * The SELECTs the list request ran (the profiler's log also holds what the test wrote before it).
     */
    private function selectsOfTheList(): int
    {
        $this->client->enableProfiler();
        $this->list('facets=status,source,pinned');
        $profile = $this->client->getProfile();
        self::assertNotFalse($profile);
        $db = $profile->getCollector('db');
        \assert($db instanceof \Symfony\Bridge\Doctrine\DataCollector\DoctrineDataCollector);
        $sql = array_column($db->getQueries()['default'] ?? [], 'sql');

        return \count(array_filter($sql, static fn (string $q): bool => str_starts_with($q, 'SELECT')));
    }
}
