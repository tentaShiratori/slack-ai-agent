FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY local/server.ts ./local/server.ts
ENV NODE_OPTIONS=--experimental-strip-types
EXPOSE 3000
CMD ["node", "local/server.ts"]
