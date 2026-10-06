<?php

namespace App\Settings\Application\Port;

/** The mail server refused an email or could not be reached; the message is the server's own (never a password). */
final class MailNotSent extends \RuntimeException
{
}
