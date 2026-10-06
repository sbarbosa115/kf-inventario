<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class CommentNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('comment_not_found', 'Comment not found.');
    }
}
