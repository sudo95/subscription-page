# Страница подписки Remnawave с правками (README.md рядом).
# Образ Remnawave как есть — выдача подписок VPN-клиентам не меняется;
# заменён только собранный фронтенд: исходники той же версии + наши файлы из src/.
ARG PAGE_VERSION=8.0.1

FROM node:24.22-trixie-slim AS build
ARG PAGE_VERSION
WORKDIR /opt/page

ADD https://github.com/remnawave/subscription-page/archive/refs/tags/${PAGE_VERSION}.tar.gz /tmp/page.tar.gz
RUN tar -xzf /tmp/page.tar.gz --strip-components=1 && rm /tmp/page.tar.gz

WORKDIR /opt/page/frontend
RUN npm ci --no-audit --no-fund

# Наши файлы поверх их frontend/src: новые и заменённые целиком.
COPY src/ ./src/

# Адрес API бэкенда (как APP_URL) и ссылка на исходники страницы — в сборку.
ARG RENEWAL_API_URL
ARG SOURCE_URL
RUN test -n "$RENEWAL_API_URL" || (echo "RENEWAL_API_URL is required" >&2 && exit 1)
RUN test -n "$SOURCE_URL" || (echo "SOURCE_URL is required (AGPL-3.0)" >&2 && exit 1)
ENV VITE_RENEWAL_API_URL=$RENEWAL_API_URL \
    VITE_SOURCE_URL=$SOURCE_URL
RUN npm run start:build

FROM remnawave/subscription-page:${PAGE_VERSION}
RUN rm -rf /opt/app/frontend
COPY --from=build /opt/page/frontend/dist/ /opt/app/frontend/
