# FROM node:18-alpine
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production # Use production dependencies
COPY deobfuscator.js .
ENTRYPOINT ["node", "/app/deobfuscator.js"]