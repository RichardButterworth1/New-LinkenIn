# Use official Node.js image
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source files
COPY . .

# Expose the app port
EXPOSE 3000

# Start the server
CMD [ "npm", "start" ]
