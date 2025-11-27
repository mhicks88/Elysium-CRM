# Build stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY ../../package.json ../../package-lock.json ./
COPY ../../packages ./packages
COPY ./package.json ./package.json
RUN npm install --production=false --workspace apps/web --workspace packages/shared-types
COPY . .
RUN npm run build

# Serve stage
FROM nginx:1.25-alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
