FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy application files
COPY . .

# Build the Vite app
RUN npm run build

# Install serve to serve the built frontend
RUN npm install -g serve

# Expose port
EXPOSE 5173

# Serve the static files
USER node
CMD ["serve", "-s", "dist", "-l", "5173"]
