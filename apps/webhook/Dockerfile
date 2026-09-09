FROM node:22-alpine
WORKDIR /app
COPY local/server.ts ./server.ts
ENV NODE_OPTIONS=--experimental-strip-types
EXPOSE 3000
CMD ["node", "server.ts"]
