FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
