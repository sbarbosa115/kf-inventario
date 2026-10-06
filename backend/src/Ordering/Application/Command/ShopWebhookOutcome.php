<?php

namespace App\Ordering\Application\Command;

/** How the webhook answers the shop. */
enum ShopWebhookOutcome
{
    /** No connection has this token: 404, nothing stored. */
    case UnknownToken;
    /** The signature is missing or wrong: 401, an inbox row without the body, the connection's health. */
    case BadSignature;
    /** Placed, a duplicate, or kept in the inbox: 200 — the shop must not retry it. */
    case Accepted;
}
