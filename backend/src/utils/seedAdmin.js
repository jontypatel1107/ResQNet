import dotenv from "dotenv";
dotenv.config();

import "../config/dns.js"; // Reliable Atlas SRV resolution (shared with the server)
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { getDemoAccounts } from "../config/demoAccounts.js";

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI is not set in backend/.env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);

    const adminAccount = getDemoAccounts().find((account) => account.role === "admin");
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || adminAccount.email;
    const adminPassword = process.env.ADMIN_PASSWORD || adminAccount.password;
    const adminName = adminAccount.name;
    const adminPhone = adminAccount.phone;

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`Admin account [${adminEmail}] already exists. Updating credentials...`);
      const salt = await bcrypt.genSalt(10);
      existingAdmin.passwordHash = await bcrypt.hash(adminPassword, salt);
      existingAdmin.role = "admin";
      existingAdmin.isActive = true;
      await existingAdmin.save();
      console.log("Admin credentials updated successfully.");
    } else {
      console.log(`Creating new Admin user [${adminEmail}]...`);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      await User.create({
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        role: "admin",
        isActive: true,
      });
      console.log("Admin account successfully created!");
    }

    console.log("\n=================================");
    console.log("ResQNet Admin Seeded Credentials:");
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`Role:     admin`);
    console.log("=================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed admin:", error.message);
    process.exit(1);
  }
};

seedAdmin();
