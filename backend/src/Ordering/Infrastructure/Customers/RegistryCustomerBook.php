<?php

namespace App\Ordering\Infrastructure\Customers;

use App\Customers\Application\Command\AddressData;
use App\Customers\Application\Command\CityData;
use App\Customers\Application\Command\CountryData;
use App\Customers\Application\Command\SaveCustomer;
use App\Customers\Application\Command\StateData;
use App\Customers\Application\Service\CustomerRegistry;
use App\Customers\Domain\Model\Customer;
use App\Ordering\Application\Command\OrderAddress;
use App\Ordering\Application\Command\OrderCustomer;
use App\Ordering\Application\Port\CustomerBook;

/**
 * An order's customer, found and updated or created by Customers' own rule (CustomerRegistry::addOrUpdate, in the
 * caller's command transaction): this adapter only translates Ordering's DTOs into Customers' command.
 */
final class RegistryCustomerBook implements CustomerBook
{
    public function __construct(private readonly CustomerRegistry $registry)
    {
    }

    public function addOrUpdate(OrderCustomer $customer): Customer
    {
        return $this->registry->addOrUpdate(new SaveCustomer(
            $customer->id,
            $customer->firstName,
            $customer->lastName,
            $customer->email,
            $customer->phone,
            array_map(self::address(...), $customer->addresses),
        ));
    }

    private static function address(OrderAddress $address): AddressData
    {
        return new AddressData(
            $address->address,
            $address->zipCode,
            $address->addressType,
            new CityData(
                $address->cityId,
                $address->cityName,
                new StateData(
                    $address->stateId,
                    $address->stateName,
                    $address->stateCode,
                    new CountryData($address->countryId, $address->countryName, $address->countryCode),
                ),
            ),
        );
    }
}
