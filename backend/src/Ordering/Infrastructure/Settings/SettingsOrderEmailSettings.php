<?php

namespace App\Ordering\Infrastructure\Settings;

use App\Ordering\Application\Port\OrderEmailSettings;
use App\Settings\Application\Query\EmailSettings;

/** The order email's sender, printer and cc from the Settings context (its Application layer: SettingsApi). */
final class SettingsOrderEmailSettings implements OrderEmailSettings
{
    public function __construct(private readonly EmailSettings $settings)
    {
    }

    public function fromAddress(): string
    {
        return $this->settings->effective()->fromAddress;
    }

    public function fromName(): string
    {
        return $this->settings->effective()->fromName;
    }

    public function printerAddress(): string
    {
        return $this->settings->effective()->printerAddress;
    }

    public function cc(): array
    {
        return $this->settings->effective()->cc;
    }
}
