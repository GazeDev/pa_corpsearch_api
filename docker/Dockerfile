FROM node:12.16.1

WORKDIR /usr/src/api

# For npm@5 or later, copy package-lock.json as well
COPY ./package.json ./package-lock.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 8081
