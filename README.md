## OpenSource Small Business Inventory Software 

Inventory system allow you and your company track and manage your warehouses, clients and business process from one point.

## Installation

1. Clone the repo from URL: git clone https://github.com/sbarbosa115/inventory.git
2. Go to Docker/nginx/site.conf and edit it using your custom configuration.
3. Customer your local host and add the configuration that enable you use the software via browser.
4. If you are using docker run
    ```
    docker-compose up
    ```

1. `docker network create nginx-proxy`
2. `docker run -d -p 80:80 -p 443:443 --network nginx-proxy --restart always --name talentu_proxy -v /var/run/docker.sock:/tmp/docker.sock:ro jwilder/nginx-proxy`
3. `git clone git@bitbucket.org:trabajamejor/bpe.git`
4. `cd bpe`
5. `docker-compose up`
6. Create a virtual on your host file:

    `127.0.0.1    inventory.local`
    
    Guide to locale your host file:
    
    `Windows: c:\Windows\System32\Drivers\etc\hosts`
    
    `Linux: /etc/hosts`
    
    `Mac: /etc/hosts`
   
then
    
    yarn build development  

Go to `http://inventory.local`

---

## Xdebug

In order to use xdebug you should configure your local IP on Docker/php/xdebug.ini at xdebug.remote_host

e.g

    xdebug.remote_host = 192.168.1.150

It require to have PHPStorm or Visual Studio code properly configured.

## Unit Testing

For PHPUnit: 

    ./vendor/bin/phpunit

For Jest

    jest
