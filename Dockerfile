FROM node:20-slim
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 2000 app && useradd --uid 2000 --gid 2000 -m -s /bin/bash app
WORKDIR /app
COPY --chown=app:app package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --chown=app:app . .
RUN npm run build
RUN npm prune --production
USER app
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["npm", "start"]
