<?php

namespace App\Ordering\Application\Port;

/** An order note on the shop (only customer notes become `shop` comments: Open questions, answer 2). */
final readonly class RemoteNote
{
    public function __construct(
        public string $id,
        public string $note,
        public bool $customerNote,
        public ?\DateTimeImmutable $createdAt,
    ) {
    }
}
