import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import "./passport.js";
import router from "./route.js";
import notesRouter from "./notesRoute.js";
import labelsRouter from "./labelsRoute.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(helmet());
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL]
      : ["http://localhost:3005", "http://localhost:3004", "http://localhost:3003", "http://localhost:3002", "http://localhost:3001", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/oauth", router);
app.use("/api/notes", notesRouter);
app.use("/api", labelsRouter);

// Fallback route for /login (in case of OAuth failures)
app.get("/login", (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
});

// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "Authentication API is running",
    endpoints: {
      signup: "POST /oauth/signup",
      login: "POST /oauth/login",
      googleAuth: "GET /oauth/google",
      profile: "GET /oauth/profile (requires auth)",
      testGoogle: "GET /oauth/test-google"
    }
  });
});

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});
