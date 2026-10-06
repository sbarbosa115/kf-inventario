<?php

namespace App\Tests\Unit\Shared;

use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\DateRangeFilter;
use App\Shared\Application\Query\ListField;
use App\Shared\Application\Query\ListSchema;
use App\Shared\Application\Query\NumberRangeFilter;
use App\Shared\Application\Query\TextFilter;
use App\Shared\UI\Http\ApiValidationException;
use App\Shared\UI\Http\ListQueryParser;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;

/**
 * The list-query contract (docs/pdr/prd-shops-settings.md, "List query contract"): page, per_page, sort, q,
 * filter[<field>] by type and facets, checked against the endpoint's allow-list; anything else is a 422.
 */
final class ListQueryParserTest extends TestCase
{
    private function schema(bool $allowAll = false): ListSchema
    {
        return new ListSchema(
            fields: [
                'code' => ListField::text(),
                'status' => ListField::enum(['1', '2', '3']),
                'source' => ListField::enumMatching('/^(phone|web|shop:\d+)$/'),
                'created_at' => ListField::date(),
                'total' => ListField::number(),
            ],
            sorts: ['code', 'created_at'],
            defaultSort: '-created_at',
            allowAll: $allowAll,
        );
    }

    /**
     * @param array<string, mixed> $query
     */
    private function parse(array $query, bool $allowAll = false): \App\Shared\Application\Query\ListQuery
    {
        return (new ListQueryParser())->parse(new Request($query), $this->schema($allowAll));
    }

    /**
     * @param array<string, mixed> $query
     *
     * @return list<string>
     */
    private function violationsOf(array $query, bool $allowAll = false): array
    {
        try {
            $this->parse($query, $allowAll);
        } catch (ApiValidationException $e) {
            return array_column($e->getViolations(), 'field');
        }
        self::fail('A 422 was expected for '.json_encode($query));
    }

    public function testWithNothingAskedItIsTheFirstPageOf25InTheDefaultOrder(): void
    {
        $query = $this->parse([]);

        self::assertSame(1, $query->page);
        self::assertSame(25, $query->perPage);
        self::assertSame(0, $query->offset());
        self::assertNotNull($query->sort);
        self::assertSame('created_at', $query->sort->field);
        self::assertTrue($query->sort->descending);
        self::assertNull($query->q);
        self::assertSame([], $query->filters);
        self::assertSame([], $query->facets);
    }

    public function testPageSortAndSearchAreRead(): void
    {
        $query = $this->parse(['page' => '3', 'per_page' => '50', 'sort' => 'code', 'q' => '  W0001 ']);

        self::assertSame(3, $query->page);
        self::assertSame(50, $query->perPage);
        self::assertSame(100, $query->offset());
        self::assertNotNull($query->sort);
        self::assertSame('code', $query->sort->field);
        self::assertFalse($query->sort->descending);
        self::assertSame('W0001', $query->q, 'q is trimmed.');
    }

    public function testEveryFilterTypeIsParsedIntoItsValueObject(): void
    {
        $query = $this->parse(['filter' => [
            'code' => 'W00',
            'status' => ['1', '3'],
            'source' => ['web', 'shop:4'],
            'created_at' => ['from' => '2026-10-01', 'to' => '2026-10-06'],
            'total' => ['min' => '100', 'max' => '500.50'],
        ]]);

        $code = $query->filters['code'];
        self::assertInstanceOf(TextFilter::class, $code);
        self::assertSame('W00', $code->text);
        $status = $query->filters['status'];
        self::assertInstanceOf(AnyOfFilter::class, $status);
        self::assertSame(['1', '3'], $status->values);
        self::assertInstanceOf(AnyOfFilter::class, $query->filters['source']);
        $created = $query->filters['created_at'];
        self::assertInstanceOf(DateRangeFilter::class, $created);
        self::assertNotNull($created->from);
        self::assertNotNull($created->to);
        self::assertSame('2026-10-01 00:00:00', $created->from->format('Y-m-d H:i:s'));
        self::assertSame('2026-10-06 00:00:00', $created->to->format('Y-m-d H:i:s'), 'Both ends are days; the applier makes "to" inclusive.');
        self::assertSame('America/Bogota', $created->from->getTimezone()->getName(), 'Days are Bogota days.');
        $total = $query->filters['total'];
        self::assertInstanceOf(NumberRangeFilter::class, $total);
        self::assertSame('100', $total->min);
        self::assertSame('500.50', $total->max);
    }

    public function testEmptyFiltersAreIgnored(): void
    {
        $query = $this->parse(['filter' => ['code' => '  ', 'status' => [], 'created_at' => ['from' => '', 'to' => ''], 'total' => ['min' => '']]]);

        self::assertSame([], $query->filters, 'An emptied control is no filter.');
    }

    public function testAnEnumGivenAsOneValueIsAListOfOne(): void
    {
        $status = $this->parse(['filter' => ['status' => '2']])->filters['status'];

        self::assertInstanceOf(AnyOfFilter::class, $status);
        self::assertSame(['2'], $status->values);
    }

    public function testFacetsAreTheEnumFieldsAsked(): void
    {
        self::assertSame(['status', 'source'], $this->parse(['facets' => 'status, source'])->facets);
    }

    public function testAnUnknownFilterFieldIsRefusedOnItsField(): void
    {
        self::assertSame(['filter.password'], $this->violationsOf(['filter' => ['password' => 'x']]));
    }

    public function testAValueOutsideTheEnumIsRefused(): void
    {
        self::assertSame(['filter.status'], $this->violationsOf(['filter' => ['status' => ['9']]]));
        self::assertSame(['filter.source'], $this->violationsOf(['filter' => ['source' => ['shop:x']]]));
    }

    public function testAFilterOfTheWrongShapeIsRefused(): void
    {
        self::assertSame(['filter.code'], $this->violationsOf(['filter' => ['code' => ['a', 'b']]]), 'A text filter is one string.');
        self::assertSame(['filter.created_at'], $this->violationsOf(['filter' => ['created_at' => ['from' => '06/10/2026']]]), 'Dates are YYYY-MM-DD.');
        self::assertSame(['filter.created_at'], $this->violationsOf(['filter' => ['created_at' => ['from' => '2026-02-30']]]), 'A day that does not exist.');
        self::assertSame(['filter.total'], $this->violationsOf(['filter' => ['total' => ['min' => '1e9']]]), 'Plain decimals only.');
        self::assertSame(['filter.created_at'], $this->violationsOf(['filter' => ['created_at' => '2026-10-01']]), 'A range is from/to.');
    }

    public function testUnknownSortsPagesAndFacetsAreRefused(): void
    {
        self::assertSame(['sort'], $this->violationsOf(['sort' => 'password']));
        self::assertSame(['sort'], $this->violationsOf(['sort' => '-status']), 'Only the allow-listed sorts.');
        self::assertSame(['page'], $this->violationsOf(['page' => '0']));
        self::assertSame(['per_page'], $this->violationsOf(['per_page' => '101']));
        self::assertSame(['per_page'], $this->violationsOf(['per_page' => 'ten']));
        self::assertSame(['facets'], $this->violationsOf(['facets' => 'code']), 'Facets count enum columns only.');
    }

    public function testEveryRowAtOnceOnlyWhereTheEndpointAllowsIt(): void
    {
        self::assertSame(['per_page'], $this->violationsOf(['per_page' => '0']));

        $query = $this->parse(['per_page' => '0', 'page' => '4'], allowAll: true);
        self::assertTrue($query->all());
        self::assertSame(1, $query->page, 'Every row is one page.');
        self::assertSame(0, $query->offset());
    }

    public function testSeveralMistakesAreReportedTogether(): void
    {
        self::assertSame(['sort', 'filter.nope', 'filter.status'], $this->violationsOf(['sort' => 'x', 'filter' => ['nope' => 'a', 'status' => ['7']]]));
    }
}
