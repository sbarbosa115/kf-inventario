<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260205093100 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add payment_method column to invoice';
    }

    public function up(Schema $schema): void
    {
        // add payment_method column
        $this->addSql('ALTER TABLE invoice ADD payment_method VARCHAR(100) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // drop payment_method column
        $this->addSql('ALTER TABLE invoice DROP payment_method');
    }
}
