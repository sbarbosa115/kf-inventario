<?php

namespace App\Tests\Legacy\Service;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

class InvoiceServiceTest extends KernelTestCase
{
    public function testCreateFromProducts()
    {
        self::bootKernel();
        $container = static::getContainer();
        $service = $container->get('App\\Services\\InvoiceService');
        $result = $service->createFromProducts(['items' => [['description' => 't', 'quantity' => 1, 'unitPrice' => 10]]]);
        $this->assertArrayHasKey('id', $result);
    }
}
