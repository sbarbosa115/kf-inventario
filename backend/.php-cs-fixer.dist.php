<?php

// PHP-CS-Fixer with the Symfony coding standard (steps/05-static-analysis.md §5.2).
// Check: vendor/bin/php-cs-fixer fix --dry-run --diff   Fix: vendor/bin/php-cs-fixer fix

$finder = (new PhpCsFixer\Finder())
    ->in(__DIR__)
    ->exclude(['var', 'vendor', 'node_modules', 'public'])
    ->notPath('config/reference.php')
    // Already run in production and recorded by class name: never reformatted (docs/pdr/prd-restructure.md).
    ->exclude('migrations')
    // The legacy Twig app and its tests stay byte-identical: they are the reference the restructure's items port
    // (and test against), and item 12 deletes them.
    ->exclude([
        'src/Command', 'src/Constraints', 'src/Controller', 'src/DataProviders', 'src/EventListener', 'src/Form',
        'src/Model', 'src/Repository', 'src/Security', 'src/Services', 'src/Validator',
        'tests/Legacy',
    ])
;

return (new PhpCsFixer\Config())
    ->setRiskyAllowed(true)
    ->setRules([
        '@Symfony' => true,
        '@Symfony:risky' => true,
    ])
    ->setParallelConfig(PhpCsFixer\Runner\Parallel\ParallelConfigFactory::detect())
    ->setFinder($finder)
;
