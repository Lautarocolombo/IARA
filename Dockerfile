FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm ci --only=production && npm ci --prefix backend --only=production

COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY public/ ./public/
COPY scripts/ ./scripts/

RUN node scripts/backup.js

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]