FROM node:20-alpine

# Install build tools
RUN apk add --no-cache python3 make g++ bash postgresql-client

WORKDIR /app

# Copy package.json first
COPY package*.json ./

# Install production dependencies (no lockfile needed)
RUN npm install --omit=dev

# Copy rest of the source code
COPY . .

EXPOSE 3002
CMD ["npm", "start"]
