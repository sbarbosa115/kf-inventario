<?php

namespace App\Tests\Functional\Invoicing;

use App\Customers\Domain\Model\Customer;
use App\Invoicing\Domain\Model\Invoice;
use App\Invoicing\Domain\Model\InvoiceItem;
use App\Tests\Functional\Ordering\OrderingFixtures;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Invoices (ports the legacy InvoiceServiceTest / InvoiceControllerTest and the rules of InvoiceService and the
 * legacy controller): create with lines and tax, the customer by id or by payload, the default address, the
 * suggested next code, the list and the detail, the PDF, and who may do what.
 */
final class InvoiceApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    public function testCreatingAnInvoiceKeepsItsLinesAndTheTaxRoundedAsTheLegacyServiceDid(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_CREATE_INVOICES', 'ROLE_CAN_READ_INVOICES']);
        $product = $this->aProduct('KF-01');

        $invoice = $this->sendJson('POST', '/api/v1/invoices', $this->payload([
            'tax_rate' => '6',
            'items' => [
                ['product_id' => $product->getId(), 'description' => 'ignored: the product names the line', 'quantity' => 3, 'unit_price' => '11.11'],
                ['description' => 'Shipping', 'quantity' => 1, 'unit_price' => '5.55', 'discount' => '5.55'],
            ],
        ]));

        $this->assertStatus(201);
        self::assertSame('INV-0001', $invoice['code']);
        self::assertSame('credit_card', $invoice['payment_method']);
        self::assertSame('Paid in cash', $invoice['comment']);
        self::assertSame('33.33', $invoice['subtotal']);
        self::assertSame('6.00', $invoice['tax_rate']);
        self::assertSame('2.00', $invoice['tax_amount'], '33.33 x 6 % = 1.9998, rounded to 2.00.');
        self::assertSame('35.33', $invoice['total']);
        self::assertSame([
            ['description' => 'Title KF-01', 'quantity' => 3, 'unit_price' => '11.11', 'discount' => '0.00', 'total' => '33.33', 'product' => ['id' => $product->getId(), 'code' => 'KF-01']],
            ['description' => 'Shipping', 'quantity' => 1, 'unit_price' => '5.55', 'discount' => '5.55', 'total' => '0.00', 'product' => null],
        ], array_map(static function (array $line): array {
            unset($line['id']);

            return $line;
        }, $invoice['items']));
        self::assertMatchesRegularExpression('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/', $invoice['created_at']);

        $shown = $this->getJson("/api/v1/invoices/{$invoice['id']}");
        $this->assertStatus(200);
        self::assertSame($invoice, $shown, 'What was created is what is read back.');
    }

    public function testWithoutATaxRateThereIsNoTaxAndTheTotalIsTheSubtotal(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_CREATE_INVOICES']);

        $invoice = $this->sendJson('POST', '/api/v1/invoices', $this->payload([
            'items' => [['description' => 'Part', 'quantity' => 2, 'unit_price' => '10.50'], ['description' => 'Other', 'quantity' => 1, 'unit_price' => '4.00', 'discount' => '1.00']],
        ]));

        $this->assertStatus(201);
        self::assertNull($invoice['tax_rate']);
        self::assertNull($invoice['tax_amount']);
        self::assertSame('24.00', $invoice['subtotal']);
        self::assertSame('24.00', $invoice['total']);
    }

    public function testAnInvoiceNeedsALineAndValidAmounts(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_CREATE_INVOICES']);

        $this->sendJson('POST', '/api/v1/invoices', $this->payload(['items' => []]));
        $this->assertStatus(422);
        $this->sendJson('POST', '/api/v1/invoices', $this->payload(['code' => '']));
        $this->assertStatus(422);
        $this->sendJson('POST', '/api/v1/invoices', $this->payload(['items' => [['description' => 'x', 'quantity' => 1, 'unit_price' => 'free']]]));
        $this->assertStatus(422);
        $this->sendJson('POST', '/api/v1/invoices', $this->payload(['tax_rate' => 'six']));
        $this->assertStatus(422);

        self::assertSame(0, $this->em()->getRepository(Invoice::class)->count([]));
    }

    public function testACodeThatAlreadyExistsIsRefusedWithA409(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_CREATE_INVOICES']);
        $this->sendJson('POST', '/api/v1/invoices', $this->payload());
        $this->assertStatus(201);

        $body = $this->sendJson('POST', '/api/v1/invoices', $this->payload(['comment' => 'again']));

        $this->assertStatus(409);
        self::assertSame('invoice_code_taken', $body['error']);
        self::assertSame(1, $this->em()->getRepository(Invoice::class)->count([]), 'The second invoice was not saved.');
    }

    public function testTheCustomerIsAnExistingOneByIdOrFoundOrCreatedFromThePayload(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_CREATE_INVOICES']);
        $known = $this->aCustomer('known@example.com');

        $byId = $this->sendJson('POST', '/api/v1/invoices', $this->payload(['code' => 'A-1', 'customer_id' => $known->getId()]));
        $this->assertStatus(201);
        self::assertSame($known->getId(), $byId['customer']['id']);
        self::assertSame('known@example.com', $byId['customer']['email']);
        self::assertSame('Calle 1 # 2-3', $byId['customer_address'], 'With no address typed, the customer\'s default address is copied.');

        $typed = $this->sendJson('POST', '/api/v1/invoices', $this->payload(['code' => 'A-2', 'customer_id' => $known->getId(), 'customer_address' => 'Another street 9']));
        $this->assertStatus(201);
        self::assertSame('Another street 9', $typed['customer_address'], 'An address typed on the invoice wins.');

        $payload = $this->sendJson('POST', '/api/v1/invoices', $this->payload(['code' => 'A-3', 'customer' => ['first_name' => 'Ana', 'last_name' => 'Gomez', 'email' => 'ana@example.com', 'phone' => '1', 'addresses' => [
            ['address' => 'Main St 1', 'zip_code' => '33101', 'address_type' => 2, 'city' => ['name' => 'Miami', 'state' => ['name' => 'Florida', 'country' => ['name' => 'United States']]]],
        ]]]));
        $this->assertStatus(201);
        self::assertNotSame($known->getId(), $payload['customer']['id']);
        self::assertSame('Ana', $payload['customer']['first_name']);
        self::assertSame('Main St 1', $payload['customer_address']);

        $again = $this->sendJson('POST', '/api/v1/invoices', $this->payload(['code' => 'A-4', 'customer' => ['first_name' => 'Known', 'last_name' => 'Again', 'email' => 'known@example.com', 'phone' => '2', 'addresses' => []]]));
        $this->assertStatus(201);
        self::assertSame($known->getId(), $again['customer']['id'], 'A payload with a known email reuses that customer (CustomerRegistry).');
        self::assertSame('Known', $again['customer']['first_name']);
        self::assertSame(2, $this->em()->getRepository(Customer::class)->count([]), 'Two customers: the known one and Ana.');

        $none = $this->sendJson('POST', '/api/v1/invoices', $this->payload(['code' => 'A-5']));
        $this->assertStatus(201);
        self::assertNull($none['customer']);
        self::assertNull($none['customer_address']);
    }

    public function testTheListIsNewestFirstWithTheLinesAndTheDetailOfAMissingInvoiceIs404(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_READ_INVOICES']);
        $customer = $this->aCustomer();
        $this->anInvoice('OLD-1', '2026-01-01 10:00:00', $customer);
        $this->anInvoice('NEW-1', '2026-03-01 10:00:00');

        $list = $this->getJson('/api/v1/invoices')['items'];

        $this->assertStatus(200);
        self::assertSame(['NEW-1', 'OLD-1'], array_column($list, 'code'));
        self::assertSame($customer->getId(), $list[1]['customer']['id']);
        self::assertSame('Part', $list[1]['items'][0]['description']);
        self::assertNull($list[0]['customer']);

        $body = $this->getJson('/api/v1/invoices/999999');
        $this->assertStatus(404);
        self::assertSame('invoice_not_found', $body['error']);
    }

    #[DataProvider('nextCodes')]
    public function testTheNextCodeContinuesTheLatestInvoicesCode(?string $latest, string $expected): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_CREATE_INVOICES']);
        if (null !== $latest) {
            $this->anInvoice('OLDER-9', '2020-01-01 00:00:00');
            $this->anInvoice($latest, '2021-01-01 00:00:00');
        }

        $body = $this->getJson('/api/v1/invoices/next-code');

        $this->assertStatus(200);
        self::assertSame(['code' => str_replace('{year}', date('Y'), $expected)], $body);
    }

    /**
     * @return iterable<string, array{string|null, string}>
     */
    public static function nextCodes(): iterable
    {
        yield 'no invoice yet: the year and 0001' => [null, '{year}0001'];
        yield 'a numeric code keeps its width' => ['20260001', '20260002'];
        yield 'a prefix is kept' => ['INV-0001', 'INV-0002'];
        yield 'zeros carry over' => ['INV-0099', 'INV-0100'];
        yield 'no number at the end' => ['X', 'X-1'];
        yield 'a number grows past its width' => ['A9', 'A10'];
    }

    public function testTheInvoiceAsAPdf(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_READ_INVOICES']);
        $id = $this->anInvoice('PDF-1', '2026-02-01 09:00:00', $this->aCustomer())->getId();
        $bare = $this->anInvoice('PDF-2', '2026-02-02 09:00:00')->getId();

        foreach ([$id, $bare] as $one) {
            $this->client->request('GET', "/api/v1/invoices/{$one}/pdf");

            $this->assertStatus(200);
            $response = $this->client->getResponse();
            self::assertSame('application/pdf', $response->headers->get('Content-Type'));
            self::assertStringStartsWith('%PDF', (string) $response->getContent());
        }

        $this->client->request('GET', '/api/v1/invoices/999999/pdf');
        $this->assertStatus(404);
    }

    public function testEachEndpointAsksForItsLegacyRole(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_READ_INVOICES']);
        $id = $this->anInvoice('R-1', '2026-02-01 09:00:00')->getId();
        $this->getJson('/api/v1/invoices');
        $this->assertStatus(200);
        $this->getJson("/api/v1/invoices/{$id}");
        $this->assertStatus(200);
        $this->getJson('/api/v1/invoices/next-code');
        $this->assertStatus(403, 'Reading is not creating.');
        $this->sendJson('POST', '/api/v1/invoices', $this->payload());
        $this->assertStatus(403);

        $this->signInAs(['ROLE_USER', 'ROLE_CAN_CREATE_INVOICES'], 'creator');
        $this->getJson('/api/v1/invoices/next-code');
        $this->assertStatus(200);
        $this->getJson('/api/v1/invoices');
        $this->assertStatus(403, 'Creating is not reading.');
        $this->client->request('GET', "/api/v1/invoices/{$id}/pdf");
        $this->assertStatus(403);

        $this->signInAs(['ROLE_USER', 'ROLE_ADMIN'], 'admin');
        $this->getJson('/api/v1/invoices');
        $this->assertStatus(403, 'The invoice roles are reached by no other role (as in production).');
    }

    public function testASignedOutRequestIs401(): void
    {
        $this->getJson('/api/v1/invoices');
        $this->assertStatus(401);
        $this->sendJson('POST', '/api/v1/invoices', $this->payload());
        $this->assertStatus(401);
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'code' => 'INV-0001',
            'payment_method' => 'credit_card',
            'comment' => 'Paid in cash',
            'items' => [['description' => 'Part', 'quantity' => 1, 'unit_price' => '10.00']],
        ];
    }

    private function anInvoice(string $code, string $createdAt, ?Customer $customer = null): Invoice
    {
        $item = new InvoiceItem();
        $item->setDescription('Part');
        $item->setQuantity(1);
        $item->setUnitPrice('10.00');
        $item->setDiscount('0.00');
        $item->setTotal('10.00');

        $invoice = new Invoice();
        $invoice->setCode($code);
        $invoice->setCreatedAt(new \DateTime($createdAt));
        $invoice->setCustomer($customer ? $this->em()->getReference(Customer::class, $customer->getId()) : null);
        $invoice->setTotal('10.00');
        $invoice->addItem($item);
        $this->em()->persist($invoice);
        $this->em()->flush();

        return $invoice;
    }
}
