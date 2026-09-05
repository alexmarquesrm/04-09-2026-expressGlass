FROM node:20-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

USER node

EXPOSE 3001

CMD ["npm", "start"]
