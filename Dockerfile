# Base on official NodeJS image
FROM node:12.4-stretch

WORKDIR /usr/src/app

COPY package*.json ./

# Install npm deps
RUN npm i
RUN npm i -g nodemon

COPY . .

RUN npm build

# Expose 80 port
EXPOSE 80

# Start app when container's ready
CMD ["nodemon", "app.js"]

