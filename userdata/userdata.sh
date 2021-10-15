#!/bin/bash
#sudo -i
yum update -y

# Install NVM (a command line utility to install and manage Node.js versions for specific users)
# https://tecadmin.net/install-nodejs-with-nvm/
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh

# Install NODEJS version 14.17.6
nvm install 14.17.6

# Install DOCKER
amazon-linux-extras install docker -y

# Install GIT
yum install git -y

# Install EFS TOOLS
yum install nfs-utils -y
yum install amazon-efs-utils -y

# Install cdk
npm install -g aws-cdk


# Install PM2 (a daemon process manager that will help you manage and keep your application online)
# https://pm2.keymetrics.io/docs/usage/quick-start/
npm install pm2@latest -g

#Installer l'outil de stress
amazon-linux-extras install epel -y 
yum install stress -y

#Pour stresser stress -c 8

#Installer les outils pour les metadata de l'instance
curl http://169.254.169.254/latest/meta-data/
wget https://s3.amazonaws.com/ec2metadata/ec2-metadata 
chmod u+x ec2-metadata

# Install EKSCTL
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
mv /tmp/eksctl /usr/local/bin

# Install KUBECTL commands
curl -o kubectl https://amazon-eks.s3.us-west-2.amazonaws.com/1.21.2/2021-07-05/bin/linux/amd64/kubectl
chmod +x ./kubectl
mkdir -p $HOME/bin && cp ./kubectl $HOME/bin/kubectl && export PATH=$PATH:$HOME/bin

# Install Nginx
releasever=2
basearch=x86_64
bash -c "cat << EOF >>  /etc/yum.repos.d/nginx.repo
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/amzn2/$releasever/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF"
yum update -y
yum install nginx -y
systemctl enable nginx.service
systemctl start nginx