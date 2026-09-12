FROM node:25-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV NODE_OPTIONS=--experimental-strip-types
EXPOSE 3000
CMD ["node", "src/server.ts"]
