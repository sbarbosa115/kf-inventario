<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Domain\Error\SameWarehouse;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Repository\ProductRepository;
use App\Inventory\Domain\Repository\StockRepository;
use App\Inventory\Domain\Repository\WarehouseRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

/**
 * The legacy ProductService::moveProducts: each line leaves the source's row of the product (404 when it has none,
 * 422 when it holds fewer) and is added to the destination's incoming row of it (created when there is none).
 */
final class MoveStockHandler implements CommandHandler
{
    public function __construct(
        private readonly WarehouseRepository $warehouses,
        private readonly ProductRepository $products,
        private readonly StockRepository $stock,
        private readonly ActivityLog $log,
    ) {
    }

    public function __invoke(MoveStock $command): void
    {
        $source = $this->warehouses->get($command->fromWarehouseId);
        $destination = $this->warehouses->get($command->toWarehouseId);
        if ($source->getId() === $destination->getId()) {
            throw new SameWarehouse();
        }

        foreach ($command->lines as $line) {
            $product = $this->products->getByUuidOrCode($line->uuid, $line->code);
            $this->stock->get($product, $source)->subQuantity($line->quantity);

            $incoming = $this->stock->findWithStatus($product, $destination, ProductWarehouse::STATUS_PENDING_TO_CONFIRM);
            if (null === $incoming) {
                $incoming = new ProductWarehouse();
                $incoming->setWarehouse($destination);
                $incoming->setProduct($product);
                $incoming->setStatus(ProductWarehouse::STATUS_PENDING_TO_CONFIRM);
                $this->stock->add($incoming);
            }
            $incoming->addQuantity($line->quantity);
        }

        $this->log->record('Product', "Moved products from {$source->getName()} to {$destination->getName()}", [
            'data' => array_map(static fn (StockLine $line): array => $line->toArray(), $command->lines),
        ]);
    }
}
