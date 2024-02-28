# Use an official Node.js runtime as the base image

FROM node:19.6.0-alpine
# Set the working directory within the container
WORKDIR /my-app

# Copy package.json and package-lock.json to the container
COPY package*.json ./
RUN ls

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build the React app
#RUN npm run build

# Build the React app
EXPOSE 3001
#CMD ["npm", "start"]
CMD ["node", "server/index.js"]