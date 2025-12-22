FROM node:22-alpine AS build
WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

# su-exec lets us drop privileges after fixing volume perms
RUN apk add --no-cache su-exec

# App files
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Entrypoint that fixes /data perms then runs as app
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV DB_PATH=/data/app.db
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
