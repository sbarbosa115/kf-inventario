<?php

namespace App\Invoicing\Application\Command;

use App\Customers\Application\Query\Customers;
use App\Customers\Application\Service\CustomerRegistry;
use App\Customers\Domain\Model\Customer;
use App\Inventory\Application\Query\Products;
use App\Inventory\Domain\Model\Product;
use App\Invoicing\Domain\Error\InvoiceCodeTaken;
use App\Invoicing\Domain\Model\Invoice;
use App\Invoicing\Domain\Model\InvoiceItem;
use App\Invoicing\Domain\Repository\InvoiceRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Error\NotFound;

/**
 * The legacy InvoiceService::createFromProducts, and the duplicate-code check of the legacy controller. The money is
 * worked out as it was (floats, rounded to cents at the end of each step) so the totals do not move by a cent.
 */
final class CreateInvoiceHandler implements CommandHandler
{
    public function __construct(
        private readonly InvoiceRepository $invoices,
        private readonly CustomerRegistry $registry,
        private readonly Customers $customers,
        private readonly Products $products,
    ) {
    }

    /**
     * @return int the new invoice's id
     *
     * @throws InvoiceCodeTaken
     */
    public function __invoke(CreateInvoice $command): int
    {
        if (null !== $this->invoices->findByCode($command->code)) {
            throw new InvoiceCodeTaken();
        }

        $invoice = new Invoice();
        $invoice->setCode($command->code);
        if (!self::blank($command->comment)) {
            $invoice->setComment($command->comment);
        }
        if (!self::blank($command->paymentMethod)) {
            $invoice->setPaymentMethod($command->paymentMethod);
        }

        $customer = $this->customer($command);
        $invoice->setCustomer($customer);
        if (!self::blank($command->customerAddress)) {
            $invoice->setCustomerAddress($command->customerAddress);
        } else {
            $invoice->setCustomerAddress($customer?->getDefaultAddress()?->getAddress());
        }

        $subtotal = 0.0;
        foreach ($command->lines as $line) {
            $subtotal += $this->addLine($invoice, $line);
        }

        $taxRate = (float) $command->taxRate;
        $taxAmount = round($subtotal * ($taxRate / 100.0), 2);
        if ($taxRate > 0.0) {
            $invoice->setTaxRate(number_format($taxRate, 2, '.', ''));
            $invoice->setTaxAmount(number_format($taxAmount, 2, '.', ''));
        }
        $invoice->setTotal(number_format($subtotal + $taxAmount, 2, '.', ''));

        return $this->invoices->identify($invoice);
    }

    private function customer(CreateInvoice $command): ?Customer
    {
        if (null !== $command->customer) {
            return $this->registry->addOrUpdate($command->customer);
        }
        if (null === $command->customerId) {
            return null;
        }

        try {
            return $this->customers->byId($command->customerId);
        } catch (NotFound) {
            // As before: an id that names nobody leaves the invoice without a customer.
            return null;
        }
    }

    /**
     * @return float the line's total
     */
    private function addLine(Invoice $invoice, InvoiceLine $line): float
    {
        $item = new InvoiceItem();
        $product = $this->product($line->productId);
        $item->setProduct($product);
        $item->setDescription($product ? $product->getTitle() : ($line->description ?? ''));

        $unitPrice = (float) $line->unitPrice;
        $discount = (float) $line->discount;
        $total = ($unitPrice * $line->quantity) - $discount;
        $item->setUnitPrice(number_format($unitPrice, 2, '.', ''));
        $item->setQuantity($line->quantity);
        $item->setDiscount(number_format($discount, 2, '.', ''));
        $item->setTotal(number_format($total, 2, '.', ''));
        $invoice->addItem($item);

        return $total;
    }

    private function product(?int $id): ?Product
    {
        if (null === $id) {
            return null;
        }

        try {
            return $this->products->byId($id);
        } catch (NotFound) {
            // As before: a product that no longer exists leaves the line with the description it came with.
            return null;
        }
    }

    private static function blank(?string $value): bool
    {
        return null === $value || '' === $value;
    }
}
