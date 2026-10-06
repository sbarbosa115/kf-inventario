<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Repository\ProductRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * A product made by hand (the legacy new-product form): no stock until some is uploaded, scanned or moved.
 */
final class CreateProductHandler implements CommandHandler
{
    public function __construct(private readonly ProductRepository $products)
    {
    }

    /**
     * @return string the new product's uuid
     */
    public function __invoke(CreateProduct $command): string
    {
        $product = new Product();
        $product->setCode($command->code);
        $product->setTitle($command->title);
        $product->setDetail($command->detail);
        $product->setStatus($command->status);
        $product->setPrice($command->price);
        // The uuid is given on persist (Product::setUuid, a PrePersist callback).
        $this->products->add($product);

        return (string) $product->getUuid();
    }
}
