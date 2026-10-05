<?php

namespace App\Tests\Functional\Invoicing;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

final class InvoiceRedirectsTest extends ApiTestCase
{
    use SignsIn;

    public function testTheOldInvoicePagesRedirectToTheNewScreens(): void
    {
        $this->signInAs(['ROLE_USER', 'ROLE_CAN_READ_INVOICES', 'ROLE_CAN_CREATE_INVOICES']);

        foreach (['/admin/invoice/' => '/admin/invoices', '/admin/invoice/new' => '/admin/invoices/new'] as $old => $new) {
            $this->client->request('GET', $old);

            $this->assertStatus(301, "{$old} is a bookmark worth keeping.");
            self::assertSame($new, parse_url((string) $this->client->getResponse()->headers->get('Location'), \PHP_URL_PATH));
        }
    }
}
