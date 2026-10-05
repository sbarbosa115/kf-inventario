<?php

namespace App\DataFixtures;

use App\Entity\Invoice;
use App\Entity\InvoiceItem;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

class InvoiceFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        $inv = new Invoice();
        $inv->setCode('INV-0001');
        $inv->setTotal('100.00');
        $manager->persist($inv);

        $item = new InvoiceItem();
        $item->setDescription('Example product');
        $item->setQuantity(1);
        $item->setUnitPrice('100.00');
        $item->setTotal('100.00');
        $item->setInvoice($inv);
        $manager->persist($item);

        $manager->flush();
    }
}
