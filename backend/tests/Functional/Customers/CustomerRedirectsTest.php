<?php

namespace App\Tests\Functional\Customers;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

final class CustomerRedirectsTest extends ApiTestCase
{
    use SignsIn;

    public function testTheOldCustomerPagesRedirectToTheNewScreens(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);

        foreach (['/admin/customer/' => '/admin/customers', '/admin/customer/new' => '/admin/customers/new', '/admin/customer/edit/3' => '/admin/customers'] as $old => $new) {
            $this->client->request('GET', $old);

            $this->assertStatus(301, "{$old} is a bookmark worth keeping.");
            self::assertSame($new, parse_url((string) $this->client->getResponse()->headers->get('Location'), \PHP_URL_PATH));
        }
    }
}
