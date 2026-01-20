# ---- Base Stage ----

FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
# ---- Dependencies Stage ----

FROM base AS dependencies
# Use npm ci for clean, reproducible builds from package-lock.json

RUN npm ci --only=production
# ---- Production Stage ----

FROM node:20-slim AS production
WORKDIR /app
Copy built dependencies from the dependencies stage

COPY --from=dependencies /app/node_modules ./node_modules
Copy application source code

COPY . .
# Create a non-root user and group for security

RUN addgroup --system --gid 1001 nodejs &&
adduser --system --uid 1001 node
# Create the data directory and ensure the 'node' user has ownership. This is crucial for the volume mount to work correctly, allowing server.js to write the db.json file.

RUN mkdir -p /app/data &&
chown -R node:nodejs /app/data
# Switch to the non-root user

USER node
# Expose the port the app runs on

EXPOSE 3000
# Set Node.js environment to production

ENV NODE_ENV=production
# The command to run the application

CMD ["node", "server.js"]
