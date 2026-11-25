import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import VolunteerProfile from "../models/VolunteerProfile.js";
import { getDemoAccounts } from "../config/demoAccounts.js";

/**
 * Creates the demo accounts used by the mobile app's quick-fill presets.
 *
 * - On server startup (development only) it only creates accounts that are
 *   missing, so a user never has their password silently overwritten.
 * - When run directly with `npm run seed:demo` it resets the demo credentials,
 *   which is useful after changing a password while testing.
 */
export const seedDemoUsers = async ({ updateExisting = false } = {}) => {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const results = [];

  for (const account of getDemoAccounts()) {
    const email = account.email.trim().toLowerCase();
    const existingUser = await User.findOne({ email });

    if (existingUser && !updateExisting) {
      // Ensure the volunteer always has a profile, even when the account was
      // created before this seed script existed. Never overwrite user edits.
      if (account.volunteerProfile) {
        await VolunteerProfile.updateOne(
          { userId: existingUser._id },
          {
            $setOnInsert: {
              userId: existingUser._id,
              ...account.volunteerProfile,
            },
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
      results.push({ email, role: account.role, status: "already_exists" });
    } else {
      const passwordHash = await bcrypt.hash(account.password, 10);

      let user = existingUser;
      if (!user) {
        user = await User.create({
          name: account.name,
          email,
          phone: account.phone,
          passwordHash,
          role: account.role,
          isActive: true,
        });
      } else {
        user.name = account.name;
        user.phone = account.phone;
        user.role = account.role;
        user.passwordHash = passwordHash;
        user.isActive = true;
        await user.save();
      }

      if (account.volunteerProfile) {
        await VolunteerProfile.updateOne(
          { userId: user._id },
          {
            $set: {
              ...account.volunteerProfile,
              userId: user._id,
            },
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }

      results.push({
        email,
        role: account.role,
        status: existingUser ? "updated" : "created",
      });
    }
  }

  return results;
};

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const dotenv = (await import("dotenv")).default;
  dotenv.config();
  await import("../config/dns.js");

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not set in backend/.env");
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    const results = await seedDemoUsers({ updateExisting: true });

    console.log("\n=================================");
    console.log("ResQNet Demo Accounts (ready to use):");
    for (const account of getDemoAccounts()) {
      console.log(
        `${account.role.padEnd(10)} ${account.email.padEnd(26)} ${account.password}`
      );
    }
    console.log("=================================");
    console.log("Seed results:", results.map((r) => `${r.email}: ${r.status}`).join(", "));
    console.log("=================================\n");
  } catch (error) {
    console.error("Failed to seed demo accounts:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
