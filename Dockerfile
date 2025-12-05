FROM node:18

WORKDIR /app

# Copy only package.json for caching
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy rest of the application
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
