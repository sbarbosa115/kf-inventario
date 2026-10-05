<?php

namespace App\Customers\Application\Command;

use App\Customers\Application\Service\CustomerRegistry;
use App\Customers\Domain\Model\Customer;
use App\Shared\Application\Command\CommandHandler;

final class SaveCustomerHandler implements CommandHandler
{
    public function __construct(private readonly CustomerRegistry $registry)
    {
    }

    /**
     * Returns the customer, not an id: a new one has none until the bus commits, and the caller presents it after.
     */
    public function __invoke(SaveCustomer $command): Customer
    {
        return $this->registry->addOrUpdate($command);
    }
}
