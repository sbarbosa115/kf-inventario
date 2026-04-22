FROM ubuntu:18.04

# @TODO we need to migrate follwing into its own image
RUN apt update --fix-missing
RUN apt update && apt-get install software-properties-common curl -y
RUN add-apt-repository -y ppa:ondrej/php && apt-get update
RUN apt install nginx php8.1 php8.1-fpm php8.1-common php8.1-mysql php8.1-mbstring php8.1-xml php8.1-zip php8.1-gd php8.1-bcmath php8.1-curl\
    php8.1-sqlite3 php8.1-xdebug php8.1-redis supervisor -y && \
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY Docker/nginx/site.conf /etc/nginx/sites-available/site.conf
COPY Docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY Docker/conf/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN ln -s /etc/nginx/sites-available/site.conf /etc/nginx/sites-enabled/

WORKDIR /var/www/html

EXPOSE 80 443

CMD ["supervisord"]
