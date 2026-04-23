FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt update --fix-missing && \
    apt update && apt-get install software-properties-common curl -y && \
    add-apt-repository -y ppa:ondrej/php && apt-get update && \
    apt install -y nginx \
        php8.4 php8.4-fpm php8.4-common php8.4-mysql php8.4-mbstring php8.4-xml \
        php8.4-zip php8.4-gd php8.4-bcmath php8.4-curl php8.4-sqlite3 \
        php8.4-xdebug php8.4-redis supervisor && \
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY Docker/nginx/site.conf /etc/nginx/sites-available/site.conf
COPY Docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY Docker/conf/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN ln -s /etc/nginx/sites-available/site.conf /etc/nginx/sites-enabled/

WORKDIR /var/www/html

EXPOSE 80 443

CMD ["supervisord"]
