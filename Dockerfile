FROM strapi/base:14

# Set up working directory that will be used
WORKDIR /src/app

COPY ./ ./

RUN ls -al

# Run on port 1337
EXPOSE 1337

# We need to define the command to launch when we are going to run the image.
# We use the keyword ‘CMD’ to do that.
# The following command will execute “yarn start”.
CMD ["npm", "run", "develop"]