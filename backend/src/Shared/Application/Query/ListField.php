<?php

namespace App\Shared\Application\Query;

/**
 * One filterable column of a list endpoint. An enum lists its values, or a pattern its values must match (country
 * ids, shop:<id>).
 */
final readonly class ListField
{
    /**
     * @param list<string>|null $values
     */
    private function __construct(
        public FieldType $type,
        public ?array $values = null,
        public ?string $pattern = null,
    ) {
    }

    public static function text(): self
    {
        return new self(FieldType::Text);
    }

    /**
     * @param list<string> $values
     */
    public static function enum(array $values): self
    {
        return new self(FieldType::Enum, values: $values);
    }

    public static function enumMatching(string $pattern): self
    {
        return new self(FieldType::Enum, pattern: $pattern);
    }

    public static function date(): self
    {
        return new self(FieldType::Date);
    }

    public static function number(): self
    {
        return new self(FieldType::Number);
    }

    public function accepts(string $value): bool
    {
        if (null !== $this->values) {
            return \in_array($value, $this->values, true);
        }

        return null === $this->pattern || 1 === preg_match($this->pattern, $value);
    }
}
