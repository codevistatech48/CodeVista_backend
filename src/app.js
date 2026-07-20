const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require('./routes/admin.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const srsRevisionRoutes = require('./routes/srsRevision.routes');
const supportRoutes = require('./routes/support.routes');
const env = require('./config/env');
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

function isAllowedOrigin(origin) {
  if (!origin || env.corsOrigins.includes(origin)) return true;
  if (env.nodeEnv === 'development') {
    return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Backend is running",
  });
});
app.get("/debug", (req, res) => {
  res.json({
    message: "NEW BACKEND DEPLOYMENT",
    time: new Date(),
  });
});

app.use("/api/auth", authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/srs', srsRevisionRoutes);
app.use('/api/support', supportRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
