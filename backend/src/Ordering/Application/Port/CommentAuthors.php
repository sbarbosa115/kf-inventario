<?php

namespace App\Ordering\Application\Port;

use App\Identity\Domain\Model\User;

/**
 * Who writes an order's comments: the signed-in user.
 */
interface CommentAuthors
{
    public function get(int $userId): User;
}
