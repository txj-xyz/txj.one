# Use the official Bun image
FROM oven/bun:slim

WORKDIR /app

# Expose the port
EXPOSE 4545

# Copy package.json and install dependencies
COPY package.json .
RUN bun install

# Copy application code
COPY . .

# Define a volume to store the application files
VOLUME ["/app"]

# Start the server
CMD ["bun", "index.ts"]