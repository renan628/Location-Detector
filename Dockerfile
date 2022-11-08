FROM node:18.1-alpine as base
WORKDIR /usr
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm install
RUN npm run build

FROM node:18.1-alpine
WORKDIR /usr
COPY package.json ./
RUN npm install --omit=dev
COPY --from=base /usr/dist .
RUN npm install pm2 -g
CMD ["pm2-runtime","index.js"]