<?php

namespace App\Tests\Functional\Inventory;

use App\Inventory\Domain\Error\ProductNotFound;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Repository\ProductRepository;
use App\Inventory\Infrastructure\Persistence\DoctrineProductRepository;
use App\Tests\Support\ApiTestCase;

final class ProductRepositoryTest extends ApiTestCase
{
    public function testSeveralUuidsFindEveryProduct(): void
    {
        [$a, $b] = [$this->aProduct('KF-A'), $this->aProduct('KF-B')];
        $this->aProduct('KF-C');

        $found = $this->products()->findByUuids([(string) $a->getUuid(), (string) $b->getUuid()]);

        $codes = array_map(static fn (Product $p): ?string => $p->getCode(), $found);
        sort($codes);
        self::assertSame(['KF-A', 'KF-B'], $codes, 'The legacy finder joined the uuids into one string and found nothing for two.');
    }

    public function testAProductIsNamedByItsUuidFirstThenByItsCode(): void
    {
        $product = $this->aProduct('KF-A');

        self::assertSame('KF-A', $this->products()->getByUuidOrCode((string) $product->getUuid(), 'ignored')->getCode());
        self::assertSame('KF-A', $this->products()->getByUuidOrCode(null, 'KF-A')->getCode());

        $this->expectException(ProductNotFound::class);
        $this->products()->getByUuidOrCode(null, 'NOPE');
    }

    private function products(): ProductRepository
    {
        // Built by hand: no use case asks the container for it yet (unused private services are dropped).
        return new DoctrineProductRepository($this->em());
    }

    private function aProduct(string $code): Product
    {
        $product = new Product();
        $product->setCode($code);
        $product->setTitle('Title '.$code);
        $product->setStatus(1);
        $product->setPrice(10.0);
        $this->em()->persist($product);
        $this->em()->flush();

        return $product;
    }
}
