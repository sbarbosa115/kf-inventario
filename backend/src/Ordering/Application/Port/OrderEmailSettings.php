<?php

namespace App\Ordering\Application\Port;

/**
 * Who sends the order email, the printer that receives it and who gets a copy: Settings › Email first, the env as
 * the fallback (docs/pdr/prd-shops-settings.md, Decisions 3). Read at send time, so a change applies to the next one.
 */
interface OrderEmailSettings
{
    public function fromAddress(): string;

    public function fromName(): string;

    public function printerAddress(): string;

    /**
     * @return list<string>
     */
    public function cc(): array;
}
