<?php

namespace App\Tests\Functional\Shared;

use Doctrine\Deprecations\Deprecation;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadataFactory;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Deprecations production logged on every request or deploy, from our own code (Doctrine's own ones, such as
 * doctrine/migrations calling Table::addColumn, wait for a Doctrine release).
 */
final class DoctrineDeprecationsTest extends KernelTestCase
{
    public function testTheMappingRaisesNoDeprecation(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get(EntityManagerInterface::class);
        Deprecation::enableTrackingDeprecations();
        $before = Deprecation::getTriggeredDeprecations();

        // A factory without a cache reads every mapping again, as a cold production cache does.
        $factory = new ClassMetadataFactory();
        $factory->setEntityManager($em);
        $factory->getAllMetadata();

        $raised = [];
        foreach (Deprecation::getTriggeredDeprecations() as $link => $count) {
            if ($count > ($before[$link] ?? 0)) {
                $raised[] = $link;
            }
        }
        self::assertSame([], $raised, 'A mapping triggers a Doctrine deprecation.');
    }

    public function testNoParameterIsImplicitlyNullable(): void
    {
        $offenders = [];
        foreach (['src', 'migrations'] as $dir) {
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(\dirname(__DIR__, 3).'/'.$dir));
            foreach ($files as $file) {
                if ('php' !== $file->getExtension()) {
                    continue;
                }
                // `Type $x = null` without `?Type` (or a union holding null): deprecated since PHP 8.4.
                if (preg_match_all('/[(,]\s*(?!\?)([A-Za-z_\\\\][\w\\\\]*)\s+\$\w+\s*=\s*null\b/', (string) file_get_contents((string) $file), $m)) {
                    foreach ($m[1] as $type) {
                        if (!\in_array(strtolower($type), ['mixed', 'null'], true)) {
                            $offenders[] = $dir.'/'.$file->getFilename().' ('.$type.')';
                        }
                    }
                }
            }
        }

        self::assertSame([], $offenders, 'Write ?Type $x = null.');
    }
}
