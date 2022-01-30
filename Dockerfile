FROM node:latest
RUN npm -g install npm@6.14.14

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
# RUN npm ci --only=production
COPY . .

EXPOSE 5000
CMD [ "node", "." ]