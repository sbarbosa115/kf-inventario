<?php

namespace App\Customers\Application\Command;

use App\Customers\Domain\Repository\CustomerRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

final class DeleteCustomerHandler implements CommandHandler
{
    public function __construct(
        private readonly CustomerRepository $customers,
        private readonly ActivityLog $log,
    ) {
    }

    public function __invoke(DeleteCustomer $command): void
    {
        $customer = $this->customers->get($command->id);

        $this->log->record('Customer', "Customer {$customer->getEmail()} was deleted");
        $this->customers->remove($customer);
    }
}
