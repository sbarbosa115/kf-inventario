FROM php:8.4-fpm-alpine

# gd: Dompdf renders the logo in the order and invoice PDFs; zip + gd: PhpSpreadsheet reads and writes the stock sheets.
RUN apk add --no-cache icu-dev icu-data-full libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev linux-headers git unzip bash \
    && docker-php-ext-configure gd --with-jpeg --with-freetype \
    && docker-php-ext-install -j"$(nproc)" intl pdo_mysql zip gd opcache \
    && apk del --no-cache linux-headers

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Run as the host user so files created in the bind mount (vendor/, migrations) aren't root-owned
ARG UID=1000
ARG GID=1000
RUN addgroup -g "${GID}" app && adduser -D -u "${UID}" -G app app

COPY php.ini /usr/local/etc/php/conf.d/app.ini

USER app
WORKDIR /app
