# Base image for both development and production
FROM node:20-alpine AS base

# Set the working directory
WORKDIR /usr/src/app

# Install development dependencies and build the app
FROM base AS development

# Install application dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# For development, run the server using ts-node
CMD ["npm", "run", "dev"]

# Build the application for production
FROM base AS build

# Install production dependencies and build the app
COPY package*.json ./
RUN npm ci

# Copy source files and build for production
COPY . .
RUN npm run build

# Production image to run the app
FROM node:20-alpine AS production

# Set the working directory
WORKDIR /usr/src/app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy the built files from the build stage
COPY --from=build /usr/src/app/dist ./build

# The command to run your app using Node.js
CMD ["node", "build/index.js"]

# Expose the port your app runs on
EXPOSE 3000