#######################################################
# CREATE A DOCKER IMAGE FROM STRAPI
#######################################################
# Login as root
sudo -i
# Go to the folder where strapi files are located
cd /mnt/efs-producer/strapi
# Remove previous existing Dockerfile
rm Dockerfile -f

# Create a new Dockerfile and populate with data
touch Dockerfile
bash -c 'cat << EOF >>  Dockerfile
FROM strapi/base:14

# Set up working directory that will be used
WORKDIR /src/app

# Run on port 1337
EXPOSE 1337

# We need to define the command to launch when we are going to run the image.
# We use the keyword ‘CMD’ to do that.
# The following command will execute “yarn start”.
CMD ["npm", "run", "develop"]

EOF'
# Build Dockerfile
docker build -t strapi-img .


#######################################################
# Run a Docker container from our image
#######################################################
docker run -p1337:1337 --mount type=bind,source=/mnt/efs-producer/strapi,target=/src/app strapi-img 



#######################################################
# PUSH OUR IMAGE INTO ECR REGISTRY
#######################################################
# Login as root
sudo -i
# go to strapi folder
cd /home/ec2-user/strapi/strapi-2
# Build image fron Dockerfile
# Option -t is used to name the current image
docker build -t strapi-efs . 

# Verify if our image is listed
docker image ls

# Run a container using the new builded image
# We need to create a "bind" between strapi files that are located in the host, and files that are located in the container 
# source: is the folder where strapi files are located in the host
# target : is the folder  where strapi files are located in the container
# note that target is the WORKDIR specified in Dockerfile
docker run -p1337:1337 --mount type=bind,source=/home/ec2-user/strapi/strapi-2,target=/src/app strapi-efs:latest


# Push image to ECR repository
# Authenticate your Docker client to the Amazon ECR registry to which you intend to push your image.
aws ecr get-login-password --region me-south-1 | docker login --username AWS --password-stdin 917875368816.dkr.ecr.me-south-1.amazonaws.com

# Identify the local image to push. Run the docker images command to list the container images on your system.
docker images

# Tag your image with the Amazon ECR registry, repository, and optional image tag name combination to use.
# 18d1676bc620 is the image ID 
# 917875368816.dkr.ecr.me-south-1.amazonaws.com is the ECR Registry
# strapi-with-efs is the repository inside the registry. I created it in the console
# v1 is the imagetag the image will have in ECR. Put whatever you want. If you omit the image tag, we assume that the tag is latest.
docker tag 18d1676bc620 917875368816.dkr.ecr.me-south-1.amazonaws.com/strapi-with-efs:v1

# Push the image using the docker push command:
docker push 917875368816.dkr.ecr.me-south-1.amazonaws.com/strapi-with-efs:v1