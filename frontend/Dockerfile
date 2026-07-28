# Use official Node image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose the Vite dev server port
EXPOSE 3001

# Start the Vite dev server. 
# --host ensures it accepts connections from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]