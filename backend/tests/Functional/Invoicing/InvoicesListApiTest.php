<?php

namespace App\Tests\Functional\Invoicing;

use App\Customers\Domain\Model\Customer;
use App\Invoicing\Domain\Model\Invoice;
use App\Invoicing\Domain\Model\InvoiceItem;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * GET /api/v1/invoices in SQL (docs/pdr/prd-shops-settings.md, "List query contract", item 1): invoices filtered by
 * code, customer, payment method, created day, total (money, both ends included) and walk-in (no customer), sorted,
 * paged, with the payment method and walk-in counts.
 */
final class InvoicesListApiTest extends ApiTestCase
{
    use SignsIn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_CAN_READ_INVOICES', 'ROLE_USER']);
        $ana = (new Customer())->setFirstName('Ana')->setLastName('Diaz')->setEmail('ana@inv.test');
        $bob = (new Customer())->setFirstName('Bob')->setLastName('Stone')->setEmail('bob@inv.test');
        $this->save($ana, $bob);
        $ana = $this->em()->getReference(Customer::class, $ana->getId());
        $bob = $this->em()->getReference(Customer::class, $bob->getId());

        $this->invoice('INV-0001', '2026-10-01 00:00:00', '99.99', 'cash', $ana);
        $this->invoice('INV-0002', '2026-10-02 12:00:00', '100.00', 'credit_card', $bob);
        $this->invoice('INV-0003', '2026-10-03 18:30:00', '500.00', 'cash', null);
        $this->invoice('INV-0004', '2026-10-06 23:59:59', '500.01', 'transfer', $ana);
        $this->em()->clear();
    }

    private function invoice(string $code, string $createdAt, string $total, string $paymentMethod, ?Customer $customer): void
    {
        $item = new InvoiceItem();
        $item->setDescription('Part');
        $item->setQuantity(1);
        $item->setUnitPrice($total);
        $item->setDiscount('0.00');
        $item->setTotal($total);
        $invoice = new Invoice();
        $invoice->setCode($code);
        $invoice->setCreatedAt(new \DateTime($createdAt, new \DateTimeZone('America/Bogota')));
        $invoice->setCustomer($customer);
        $invoice->setTotal($total);
        $invoice->setPaymentMethod($paymentMethod);
        $invoice->addItem($item);
        $this->em()->persist($invoice);
        $this->em()->flush();
    }

    /**
     * @return array<mixed>
     */
    private function list(string $query = ''): array
    {
        $body = $this->getJson('/api/v1/invoices'.('' === $query ? '' : '?'.$query));
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

    public function testNewestFirstWithTheirLinesAndCustomer(): void
    {
        $body = $this->list();

        self::assertSame(['INV-0004', 'INV-0003', 'INV-0002', 'INV-0001'], array_column($body['items'], 'code'));
        self::assertSame(4, $body['total']);
        self::assertSame('Ana', $body['items'][0]['customer']['first_name']);
        self::assertNull($body['items'][1]['customer'], 'A walk-in invoice has no customer.');
        self::assertCount(1, $body['items'][0]['items'], 'Each invoice with its lines.');
        self::assertSame('500.01', $body['items'][0]['total']);
    }

    public function testTheMoneyRangeIncludesBothEnds(): void
    {
        self::assertSame(['INV-0003', 'INV-0002'], $this->codes('filter[total][min]=100&filter[total][max]=500'));
        self::assertSame(['INV-0004'], $this->codes('filter[total][min]=500.01'));
        self::assertSame(['INV-0001'], $this->codes('filter[total][max]=99.99'));
        self::assertSame(['INV-0004', 'INV-0003'], $this->codes('filter[total][min]=500'), 'Cents count: 500.01 is over 500.');

        $body = $this->getJson('/api/v1/invoices?filter[total][min]=ten');
        $this->assertStatus(422);
        self::assertSame(['filter.total'], array_column($body['violations'], 'field'));
    }

    public function testWalkInPaymentMethodDateAndCustomerFilters(): void
    {
        self::assertSame(['INV-0003'], $this->codes('filter[walk_in][]=yes'), 'Walk-in: no customer.');
        self::assertSame(['INV-0004', 'INV-0002', 'INV-0001'], $this->codes('filter[walk_in][]=no'));
        self::assertSame(['INV-0004', 'INV-0003', 'INV-0002', 'INV-0001'], $this->codes('filter[walk_in][]=yes&filter[walk_in][]=no'));
        self::assertSame(['INV-0003', 'INV-0001'], $this->codes('filter[payment_method][]=cash'));
        self::assertSame(['INV-0004', 'INV-0003', 'INV-0001'], $this->codes('filter[payment_method][]=cash&filter[payment_method][]=transfer'));
        self::assertSame(['INV-0002', 'INV-0001'], $this->codes('filter[created_at][from]=2026-10-01&filter[created_at][to]=2026-10-02'), 'Midnight on the first day is in.');
        self::assertSame(['INV-0004'], $this->codes('filter[created_at][from]=2026-10-06&filter[created_at][to]=2026-10-06'), 'One day, up to 23:59:59.');
        self::assertSame(['INV-0004', 'INV-0001'], $this->codes('filter[customer]=diaz'));
        self::assertSame(['INV-0002'], $this->codes('filter[customer]=bob%40inv'), 'Or the email.');
        self::assertSame(['INV-0003'], $this->codes('filter[code]=0003'));
        self::assertSame(['INV-0004', 'INV-0001'], $this->codes('q=ana'), 'q: code, customer name, email.');
        self::assertSame(['INV-0002'], $this->codes('q=inv-0002'));
    }

    public function testFacetsCountOverTheOtherFilters(): void
    {
        $body = $this->list('filter[walk_in][]=no&facets=walk_in,payment_method');

        self::assertSame(3, $body['total']);
        self::assertSame([['value' => 'no', 'count' => 3], ['value' => 'yes', 'count' => 1]], $body['facets']['walk_in'], 'Its own filter does not narrow it.');
        self::assertSame(
            [['value' => 'cash', 'count' => 1], ['value' => 'credit_card', 'count' => 1], ['value' => 'transfer', 'count' => 1]],
            $body['facets']['payment_method'],
            'The walk-in cash invoice is filtered out of the payment counts.',
        );
    }

    public function testSortsComeFromTheAllowList(): void
    {
        self::assertSame(['INV-0004', 'INV-0003', 'INV-0002', 'INV-0001'], $this->codes('sort=-total'));
        self::assertSame(['INV-0001', 'INV-0002', 'INV-0003', 'INV-0004'], $this->codes('sort=created_at'));
        self::assertSame(['INV-0003', 'INV-0001', 'INV-0004', 'INV-0002'], $this->codes('sort=customer'), 'No customer first, then by name, ties by id.');
        self::assertSame(['INV-0003', 'INV-0004'], $this->codes('sort=code&per_page=2&page=2'));

        $this->getJson('/api/v1/invoices?sort=payment_method');
        $this->assertStatus(422);
    }
}
