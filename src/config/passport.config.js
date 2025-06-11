// src/config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import User from "../models/User.js";
import { createNotification } from "../services/notification.js";
import dotenv from "dotenv";

dotenv.config();

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/api/v2/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

        if (user) {
          // Link Google ID if not already linked
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();

            // Optional: Notify user that Google is now linked
            await createNotification(
              user._id,
              "system",
              `Your Google account is now linked. Enjoy seamless logins.`,
              null,
              "Google Linked",
              "System"
            );
          }

          return done(null, user);
        }

        // Create new user if not found
        user = new User({
          googleId: profile.id,
          email,
          profile: { name: profile.displayName },
          isEmailVerified: true,
        });

        await user.save();

        // Send welcome notification
        await createNotification(
          user._id,
          "system",
          `Thank you for joining BetaHouse, ${user.profile.name}! Start exploring properties now!`,
          null,
          "Welcome to BetaHouse 🎉",
          "System"
        );

        return done(null, user);
      } catch (err) {
        console.error("Error in Google Strategy:", err.message);
        return done(err, null);
      }
    }
  )
);


// Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/api/auth/facebook/callback`,
      profileFields: ["id", "emails", "name"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ facebookId: profile.id });
        if (!user) {
          user = new User({
            facebookId: profile.id,
            email: profile.emails[0].value,
            profile: {
              name: `${profile.name.givenName} ${profile.name.familyName}`,
            },
            isEmailVerified: true,
          });
          await user.save();
          await createNotification(
            user._id,
            "system", // type
            "Thank you for joining BetaHouse, " +
              user.profile.name +
              "! Start exploring properties now!",
            null, // relatedId
            "Welcome to BetaHouse 🎉", // title
            "System" // relatedModel (optional if your createNotification function uses it)
          );
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

export default passport;
