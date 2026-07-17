const app = require('./app');
const http = require('http');
const env = require('./config/env');
const connectDB = require('./config/db');
const { initializeSocket } = require('./utils/socket');

async function startServer() {
  try {
    await connectDB();

    const server = http.createServer(app);
    initializeSocket(server);
    server.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
