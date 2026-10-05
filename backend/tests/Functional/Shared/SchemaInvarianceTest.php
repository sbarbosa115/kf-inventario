<?php

namespace App\Tests\Functional\Shared;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * The production database must not change (docs/pdr/prd-restructure.md, "Database invariance"). The test database is
 * built from the migrations, so what Doctrine would change to match the mappings is exactly the recorded drift
 * (baseline-drift.sql, next to this test) — and nothing else. A mapping change (a renamed table or column, a new index, a
 * changed type or nullability) shows up here as an extra or missing statement.
 */
final class SchemaInvarianceTest extends KernelTestCase
{
    public function testTheMappingsProposeExactlyTheRecordedDrift(): void
    {
        $em = self::getContainer()->get(EntityManagerInterface::class);

        $proposed = (new SchemaTool($em))->getUpdateSchemaSql($em->getMetadataFactory()->getAllMetadata());
        // Not entities: the migrations' own table (the console's schema:update filters it out the same way) and the
        // email queue's, which belongs to Messenger's doctrine transport (in-memory in tests).
        $proposed = array_values(array_filter(
            $proposed,
            static fn (string $sql): bool => !str_contains($sql, 'doctrine_migration_versions') && !str_contains($sql, 'messenger_messages'),
        ));

        self::assertSame(
            self::baseline(),
            array_map(static fn (string $sql): string => $sql.';', $proposed),
            'The mappings must describe the production schema: only the drift in baseline-drift.sql may differ. '
            .'Never fix a difference with a migration that alters an existing table.',
        );
    }

    public function testEveryEntityLivesInABoundedContextModel(): void
    {
        $em = self::getContainer()->get(EntityManagerInterface::class);

        $classes = array_map(static fn ($m): string => $m->getName(), $em->getMetadataFactory()->getAllMetadata());
        sort($classes);

        self::assertCount(16, $classes, 'The production schema has 16 entity tables (plus the migrations table).');
        foreach ($classes as $class) {
            self::assertMatchesRegularExpression('/^App\\\\[A-Za-z]+\\\\Domain\\\\Model\\\\[A-Za-z]+$/', $class);
        }
    }

    /**
     * @return list<string>
     */
    private static function baseline(): array
    {
        $lines = file(__DIR__.'/baseline-drift.sql', \FILE_IGNORE_NEW_LINES | \FILE_SKIP_EMPTY_LINES) ?: [];

        return array_values(array_filter($lines, static fn (string $line): bool => !str_starts_with($line, '--')));
    }
}
