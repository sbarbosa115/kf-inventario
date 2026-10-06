<?php

namespace App\Services;

use App\Entity\Invoice;
use App\Entity\InvoiceItem;
use App\Entity\Product;
use Doctrine\ORM\EntityManagerInterface;
use App\Services\CustomerService;

class InvoiceService
{
    private $em;
    private $customerService;

    public function __construct(EntityManagerInterface $em, CustomerService $customerService)
    {
        $this->em = $em;
        $this->customerService = $customerService;
    }

    public function createFromProducts(array $data, ?object $user = null): array
    {
        $invoice = new Invoice();
        if (!empty($data['code'])) {
            $invoice->setCode($data['code']);
        }
        if (!empty($data['comment'])) {
            $invoice->setComment($data['comment']);
        }
        if (!empty($data['paymentMethod'])) {
            $invoice->setPaymentMethod($data['paymentMethod']);
        }
        if (!empty($data['customer'])) {
            // allow passing either an id or a full customer payload
            if (is_array($data['customer']) || is_object($data['customer'])) {
                $customerData = (array) $data['customer'];
                $customer = $this->customerService->addOrUpdate($customerData);
            } else {
                $customer = $this->em->getRepository('App\\Entity\\Customer')->find($data['customer']);
            }

            if ($customer) {
                $invoice->setCustomer($customer);
            }
        }
        // customerNit removed from form/API: do not set it here

        if (!empty($data['customerAddress'])) {
            $invoice->setCustomerAddress($data['customerAddress']);
        } elseif (!empty($customer) && method_exists($customer, 'getDefaultAddress') && $customer->getDefaultAddress()) {
            $invoice->setCustomerAddress($customer->getDefaultAddress()->getAddress());
        }

        $total = 0.0;
        foreach ($data['items'] ?? [] as $itemData) {
            $item = new InvoiceItem();
            if (!empty($itemData['product'])) {
                $product = $this->em->getRepository(Product::class)->find($itemData['product']);
                $item->setProduct($product);
                $item->setDescription($product ? $product->getTitle() : ($itemData['description'] ?? ''));
            } else {
                $item->setDescription($itemData['description'] ?? '');
            }
            $unit = $itemData['unitPrice'] ?? 0;
            $qty = $itemData['quantity'] ?? 1;
            $discount = $itemData['discount'] ?? 0;
            $lineTotal = ($unit * $qty) - ($discount ?: 0);
            $item->setUnitPrice($unit);
            $item->setQuantity((int) $qty);
            $item->setDiscount($discount);
            $item->setTotal(number_format($lineTotal, 2, '.', ''));
            $invoice->addItem($item);
            $total += $lineTotal;
        }

        // apply tax if provided (taxRate is percent, e.g. 6 for 6%)
        $taxRate = !empty($data['taxRate']) ? (float) $data['taxRate'] : 0.0;
        $taxAmount = round($total * ($taxRate / 100.0), 2);

        if ($taxRate) {
            $invoice->setTaxRate(number_format($taxRate, 2, '.', ''));
            $invoice->setTaxAmount(number_format($taxAmount, 2, '.', ''));
        } else {
            $invoice->setTaxRate(null);
            $invoice->setTaxAmount(null);
        }

        $invoice->setTotal(number_format($total + $taxAmount, 2, '.', ''));
        $this->em->persist($invoice);
        $this->em->flush();

        return [
            'id' => $invoice->getId(),
            'total' => $invoice->getTotal(),
            'subtotal' => number_format($total, 2, '.', ''),
            'taxRate' => $invoice->getTaxRate(),
            'taxAmount' => $invoice->getTaxAmount(),
            'paymentMethod' => $invoice->getPaymentMethod(),
        ];
    }

    public function getInvoiceAsArray(Invoice $invoice): array
    {
        $items = [];
        foreach ($invoice->getItems() as $it) {
            $items[] = [
                'id' => $it->getId(),
                'description' => $it->getDescription(),
                'quantity' => $it->getQuantity(),
                'unitPrice' => $it->getUnitPrice(),
                'discount' => $it->getDiscount(),
                'total' => $it->getTotal(),
            ];
        }

        $customer = null;
        if ($invoice->getCustomer()) {
            $c = $invoice->getCustomer();
            $customer = [
                'id' => $c->getId(),
                'firstName' => method_exists($c, 'getFirstName') ? $c->getFirstName() : null,
                'lastName' => method_exists($c, 'getLastName') ? $c->getLastName() : null,
                'email' => method_exists($c, 'getEmail') ? $c->getEmail() : null,
                'phone' => method_exists($c, 'getPhone') ? $c->getPhone() : null,
            ];
        }

        return [
            'id' => $invoice->getId(),
            'code' => $invoice->getCode(),
            'customer' => $customer,
            'customerAddress' => $invoice->getCustomerAddress(),
            'comment' => $invoice->getComment(),
            'paymentMethod' => $invoice->getPaymentMethod(),
            'items' => $items,
            'subtotal' => $invoice->getSubtotal(),
            'taxRate' => $invoice->getTaxRate(),
            'taxAmount' => $invoice->getTaxAmount(),
            'total' => $invoice->getTotal(),
            'createdAt' => $invoice->getCreatedAt() ? $invoice->getCreatedAt()->format(DATE_ATOM) : null,
        ];
    }
}
