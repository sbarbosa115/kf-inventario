<?php

namespace App\DataFixtures;

use App\Entity\Warehouse;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

class WarehouseFixtures extends Fixture
{
    public const WAREHOUSE_BOGOTA = 'warehouse-bogota';

    public function load(ObjectManager $manager): void
    {
        $this->createWarehouses($manager);
    }

    protected function createWarehouses(ObjectManager $manager): void
    {
        $items = [
            ['name' => 'Colombia', 'url' => 'https://colombia.test'],
            ['name' => 'Usa', 'url' => 'https://usa.test'],
            ['name' => 'España', 'url' => 'https://espana.test'],
        ];

        foreach ($items as $key => $item) {
            $warehouse = new Warehouse($item['name'], $item['url']);
            $manager->persist($warehouse);

            if (0 === $key) {
                $this->addReference(self::WAREHOUSE_BOGOTA, $warehouse);
            }
        }
        $manager->flush();
    }
}
