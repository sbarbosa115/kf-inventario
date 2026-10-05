<?php

namespace App\Tests\Legacy\Form;

use App\Inventory\Domain\Model\Warehouse;
use App\Form\WarehouseType;
use Symfony\Component\Form\Test\TypeTestCase;

class WarehouseTypeTest extends TypeTestCase
{
    public function testCreateWarehouse(): void
    {
        $formData = [
            'name' => 'TEST-WAREHOUSE-01',
        ];
        $objectToCompare = new Warehouse('TEST-WAREHOUSE-01', 'http://test-warehouse-01.local/');
        $form = $this->factory->create(WarehouseType::class, $objectToCompare);

        $warehouse = new Warehouse('TEST-WAREHOUSE-01', 'http://test-warehouse-01.local/');
        $form->submit($formData);

        $this->assertTrue($form->isSynchronized());
        $this->assertEquals($warehouse, $objectToCompare);
    }
}
