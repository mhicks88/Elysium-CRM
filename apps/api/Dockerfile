FROM node:20-alpine
WORKDIR /usr/src/app
COPY ../../package.json ../../package-lock.json ./
COPY ../../packages ./packages
COPY ./package.json ./package.json
RUN npm install --production=false --workspace apps/api --workspace packages/shared-types --workspace packages/shared-utils
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/index.js"]
