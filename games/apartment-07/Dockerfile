FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build
RUN pnpm prune --prod --ignore-scripts
FROM node:22-alpine
ENV NODE_ENV=production PORT=2567
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 2567
CMD ["node", "dist-server/index.js"]
