<?php

namespace App\Tests\Unit\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class InvoiceControllerTest extends WebTestCase
{
    public function testIndexAccessible()
    {
        $client = static::createClient();
        $client->request('GET', '/invoice/');
        $this->assertTrue(in_array($client->getResponse()->getStatusCode(), [200, 302]));
    }
}
