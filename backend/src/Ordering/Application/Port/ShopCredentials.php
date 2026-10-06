<?php

namespace App\Ordering\Application\Port;

/**
 * What a call to a shop's REST API needs, opened (plain keys): built from a ShopConnection by opening its sealed
 * keys, or from the form's fields when "Test connection" runs before saving. Never logged, never in an Output.
 */
final readonly class ShopCredentials
{
    public function __construct(
        public string $siteUrl,
        #[\SensitiveParameter] public string $consumerKey,
        #[\SensitiveParameter] public string $consumerSecret,
    ) {
    }
}
