# before you can do this, you will need git to easily get this repo
# run:
# sudo apt install git

# Clone the repo
# git clone https://gitlab.com/GazeDev/pa_corpsearch_api.git

# digital ocean has a droplet with docker and docker-compose installed
# if you aren't using that, you will need to install them as well
# https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-18-04

# cd pa_corpsearch_api

# cp docker/variables.env.example docker/variables.env

# Fill out variables.env with the values of your service if needed:

# nano variables.env


docker-compose build

docker-compose up -d

# We are going to be installing things. Update software repositories
sudo apt-get update

# This is to remove password access to the droplet, only allowing ssh key access
sed -i 's/^PermitRootLogin yes/PermitRootLogin without-password/' /etc/ssh/sshd_config

sudo apt install nginx-full -y

# Allow access to ports 80 and 443
sudo ufw allow 'Nginx Full'

# Modify nginx.conf to listen for the right server_name if you need to

# Copy our config to the nginx sites-available directory, with a more specific name
sudo cp nginx.conf /etc/nginx/sites-available/pa_corpsearch_api

# Symlink repo nginx config to sites-enabled to enable it
sudo ln -sf /etc/nginx/sites-available/pa_corpsearch_api /etc/nginx/sites-enabled

# Remove the default site
sudo rm /etc/nginx/sites-enabled/default

# To check for typos in your file:
sudo nginx -t

# If you get no errors, you can restart nginx:
sudo service nginx restart

# Let's Encrypt
sudo add-apt-repository ppa:certbot/certbot -y
sudo apt-get update
sudo apt install python-certbot-nginx -y

sudo certbot --nginx -d corpsearch-api.pittsburghhousing.org
# Enter email address...:
# (A)gree to Terms
# (N)o sharing of email address
# 2 - Redirect all requests to https

# To check for typos in your file:
sudo nginx -t

# If you get no errors, you can restart nginx to apply the changes:
sudo service nginx restart
