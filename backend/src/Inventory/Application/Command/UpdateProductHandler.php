<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Domain\Repository\ProductRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * The legacy edit-product form: every field of the product, its stock untouched.
 */
final class UpdateProductHandler implements CommandHandler
{
    public function __construct(private readonly ProductRepository $products)
    {
    }

    public function __invoke(UpdateProduct $command): void
    {
        $product = $this->products->getByUuid($command->uuid);
        $product->setCode($command->code);
        $product->setTitle($command->title);
        $product->setDetail($command->detail);
        $product->setStatus($command->status);
        $product->setPrice($command->price);
    }
}
