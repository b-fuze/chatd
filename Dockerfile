# Base on official NodeJS image
FROM node:12.4-stretch

WORKDIR /usr/src/app

COPY package*.json ./

# Install npm deps
RUN npm i \
  && mkdir -p src/assets \
  && cp node_modules/socket.io-client/dist/socket.io.js src/assets/

RUN npm i -g nodemon

COPY . .

RUN npm run build

# Expose 80 port
EXPOSE 80

# Start app when container's ready
CMD ["nodemon", "app.js"]

