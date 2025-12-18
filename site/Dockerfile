# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.3
ARG BUNDLER_VERSION=2.7.2

# 1) deps stage (Ruby + Node + gems installed, NO middleman build yet)
FROM ruby:${RUBY_VERSION}-alpine AS deps
ARG BUNDLER_VERSION

WORKDIR /app

# build tools for native gems (sassc etc.) + node for ExecJS
RUN apk add --no-cache build-base nodejs npm git

RUN gem install bundler -v "${BUNDLER_VERSION}"

COPY Gemfile Gemfile.lock* /app/
RUN bundle _${BUNDLER_VERSION}_ install

# 2) build stage (now we run middleman)
FROM deps AS build
ARG BUNDLER_VERSION
ARG ADMIN_TOKEN
ENV ADMIN_TOKEN="${ADMIN_TOKEN}"

COPY . /app

# Ruby 3.3 sometimes needs Logger explicitly loaded for ActiveSupport
ENV RUBYOPT="-rlogger"

# Make ExecJS prefer Node (helps avoid “process.version” nonsense)
ENV EXECJS_RUNTIME="Node"

RUN bundle _${BUNDLER_VERSION}_ exec middleman build --clean

# 3) runtime stage (nginx serves the built site)
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
