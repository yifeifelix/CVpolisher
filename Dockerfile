FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Runtime starts through `node --import tsx server.ts`, so keep dev deps in v1.
RUN npm ci --include=dev

COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN mkdir -p /app/data /app/certs

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3443

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3443

CMD ["node", "--import", "tsx", "server.ts"]
