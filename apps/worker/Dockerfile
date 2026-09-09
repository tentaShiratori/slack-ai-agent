FROM node:25-alpine
WORKDIR /app
COPY src ./src
ENV NODE_OPTIONS=--experimental-strip-types
EXPOSE 8080
CMD ["node", "--experimental-strip-types", "src/server.ts"]
