# Build from the repository root: docker build -f apps/celebration-site-service/Dockerfile .
FROM node:24.18.1-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps ./apps
RUN yarn install --immutable
RUN yarn turbo run build --filter=@rsvp/celebration-site-service...
RUN yarn workspaces focus @rsvp/celebration-site-service --production

FROM node:24.18.1-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/celebration-site-service ./apps/celebration-site-service
WORKDIR /repo/apps/celebration-site-service
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD wget -qO- http://127.0.0.1:3001/celebrations/health || exit 1
CMD ["node", "dist/main.js"]
