# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.3
ARG BUNDLER_VERSION=2.7.2

# Base image with system deps + bundler + gems
FROM ruby:${RUBY_VERSION}-alpine AS base
ARG BUNDLER_VERSION

WORKDIR /app

# build tools for native gems + node for ExecJS + tzdata for time handling
RUN apk add --no-cache build-base nodejs npm git tzdata

# Install bundler (no "bundle _x_" at runtime needed)
RUN gem install bundler -v "${BUNDLER_VERSION}"

# Install gems
COPY Gemfile Gemfile.lock* /app/
RUN bundle install --jobs 4 --retry 3

# Build static site
FROM base AS build
COPY . /app

# Helps ActiveSupport on Ruby 3.3 sometimes
ENV RUBYOPT="-rlogger"
ENV EXECJS_RUNTIME="Node"

RUN bundle exec middleman build --clean

# Runtime (nginx serves built files)
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

# Dev server (Middleman)
FROM base AS dev
COPY . /app

ENV RUBYOPT="-rlogger"
ENV EXECJS_RUNTIME="Node"

EXPOSE 4567
CMD ["bundle", "exec", "middleman", "server", "--watcher-force-polling", "--bind-address", "0.0.0.0", "--port", "4567"]
