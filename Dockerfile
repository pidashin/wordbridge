# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the app
RUN npm run build

# --- Security Hardening ---
# Ensure the app directory is owned by the node user
RUN mkdir -p /app/data && chown -R node:node /app /app/data

# Switch to non-root user
USER node

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
