# Node.js Web App Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source
COPY . .

# Expose application port
EXPOSE 8000

# Start the app (production)
CMD ["node", "app.js"]
