FROM node:22-alpine

WORKDIR /app
COPY package.json app.js server.js ./
COPY public ./public

ENV NODE_ENV=production \
    PORT=3000

# The official node image ships a non-root "node" user (uid 1000).
USER node
EXPOSE 3000

CMD ["node", "server.js"]
