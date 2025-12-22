# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.3
ARG BUNDLER_VERSION=2.7.2

# 1) deps stage (Ruby + Node + gems installed)
FROM ruby:${RUBY_VERSION}-alpine AS deps
ARG BUNDLER_VERSION

WORKDIR /app

# build tools for native gems + node for ExecJS
RUN apk add --no-cache build-base nodejs npm git
RUN gem install bundler -v "${BUNDLER_VERSION}"

COPY Gemfile Gemfile.lock* /app/
RUN bundle _${BUNDLER_VERSION}_ install

# 2) dev stage (Middleman server)
FROM deps AS dev
ARG BUNDLER_VERSION
ARG ADMIN_TOKEN
ENV ADMIN_TOKEN="${ADMIN_TOKEN}"

ENV RUBYOPT="-rlogger"
ENV EXECJS_RUNTIME="Node"

COPY . /app
EXPOSE 4567

CMD ["sh", "-lc", "bundle _${BUNDLER_VERSION}_ exec middleman server --watcher-force-polling --bind-address 0.0.0.0 --port 4567"]

# 3) build stage (static build)
FROM deps AS build
ARG BUNDLER_VERSION
ARG ADMIN_TOKEN
ENV ADMIN_TOKEN="${ADMIN_TOKEN}"

ENV RUBYOPT="-rlogger"
ENV EXECJS_RUNTIME="Node"

COPY . /app
RUN bundle _${BUNDLER_VERSION}_ exec middleman build --clean

# 4) runtime stage (nginx serves the built site)
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
