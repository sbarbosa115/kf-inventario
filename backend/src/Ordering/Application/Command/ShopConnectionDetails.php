<?php

namespace App\Ordering\Application\Command;

/**
 * A shop connection as the form says it. Blank keys: none on a new connection, the saved ones on an edit.
 */
final readonly class ShopConnectionDetails
{
    /**
     * @param array<string, bool> $capabilities by ShopCapability value; missing ones are off
     */
    public function __construct(
        public string $name,
        public string $siteUrl,
        #[\SensitiveParameter] public ?string $consumerKey,
        #[\SensitiveParameter] public ?string $consumerSecret,
        public int $warehouseId,
        public bool $emailPrinter,
        public bool $active,
        public array $capabilities,
    ) {
    }

    public function hasConsumerKey(): bool
    {
        return null !== $this->consumerKey && '' !== trim($this->consumerKey);
    }

    public function hasConsumerSecret(): bool
    {
        return null !== $this->consumerSecret && '' !== trim($this->consumerSecret);
    }
}
