# Use official Node.js image from Docker Hub
FROM node:20.15

# Create and set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port that the app runs on
EXPOSE 9000

# Command to run the application
CMD ["npm", "start"]
