# The homeCore web app and its UI server, in one container (05 — S1, S2).
#
#   docker build -t hc-web .
#   docker run -p 3000:3000 -e HC_CORE_URL=http://homecore:8080 -v hc-web-data:/data hc-web

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Shown on System; the release passes its tag (release.yml).
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
RUN npm run build && npm run budget

FROM node:24-alpine
WORKDIR /app
# BODY_SIZE_LIMIT: the largest thing sent to the UI server's own routes is a
# plugin screen's stored document (2 MB, `/ui/plugin-store/…`). Files for a
# plugin (a firmware image) go to homeCore through the `/api` proxy instead.
ENV NODE_ENV=production \
    HC_DATA_DIR=/data \
    BODY_SIZE_LIMIT=8M \
    PORT=3000
# Everything the app needs is bundled into build/ (all packages are
# devDependencies), so the runtime is the build plus the UI server's own files.
COPY --from=build /app/build ./build
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
# Asks whichever port the server was told to use: on host networking PORT
# moves it off 3000, and a fixed 3000 would ask somebody else.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/ui/health" || exit 1
CMD ["node", "server/index.js"]
