import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { supabase } from "./database.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === 'production' 
        ? `${process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://your-backend-app.onrender.com'}/oauth/google/callback`
        : "http://localhost:3000/oauth/google/callback"
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        console.log("Google OAuth Profile received:", {
          id: profile.id,
          displayName: profile.displayName,
          emails: profile.emails
        });
        
        const email = profile.emails[0].value;
        const name = profile.displayName;

        console.log("Processing user:", { name, email });

        // First, try to find existing user
        const { data: existingUser, error: selectError } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .maybeSingle(); // Use maybeSingle instead of single to avoid error when no user found
        
        if (selectError) {
          console.error("Database select error:", selectError);
          return done(selectError, null);
        }

        let user = existingUser;

        if (!user) {
          console.log("Creating new user for:", email);
          const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert([{ 
              name, 
              email, 
              password: null, // Explicitly set password as null for Google OAuth users
              email_verified: true,
              email_verified_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            }])
            .select()
            .single();
          
          if (insertError) {
            console.error("Database insert error:", insertError);
            return done(insertError, null);
          }
          
          user = newUser;
          console.log("New user created successfully:", user.id);
        } else {
          console.log("Existing user found:", user.id);
        }
        
        return done(null, user);
      } catch (err) {
        console.error("Google OAuth strategy error:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
