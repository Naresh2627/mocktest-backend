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
      ? function(origin, callback) {
          // Allow requests with no origin (mobile apps, curl, etc.)
          if (!origin) return callback(null, true);
          
          const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL?.replace('https://', 'http://'),
          ].filter(Boolean);
          
          console.log('CORS check - Origin:', origin, 'Allowed:', allowedOrigins);
          
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
          }
        }
      : ["http://localhost:3001", "http://localhost:3005", "http://localhost:3004", "http://localhost:3003", "http://localhost:3002", "http://localhost:5173"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
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
