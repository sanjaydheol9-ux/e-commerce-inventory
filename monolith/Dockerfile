FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY monolith/ ./monolith/
EXPOSE 3000
CMD ["node", "monolith/src/server.js"]
