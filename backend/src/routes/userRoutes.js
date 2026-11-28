import express from "express";
import {
  getProfile,
  updateProfile,
  recordSafetyCheckIn,
  getMySafetyStatus,
  getPublicSafetyStatus,
} from "../controllers/userController.js";
import {
  getTrustedCircle,
  addTrustedContact,
  updateTrustedContact,
  deleteTrustedContact,
  updateTrustedCircleSettings,
  sendTestAlert,
} from "../controllers/trustedCircleController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Safety Status Lookup (family & relatives can search without logging in)
router.get("/public-safety-status", getPublicSafetyStatus);

router.use(authenticate);

// Profile
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// Disaster Safety Check-In ("I Am Safe")
router.post("/safety-checkin", recordSafetyCheckIn);
router.get("/safety-status", getMySafetyStatus);

// Trusted Circle & Emergency Contacts
router.get("/trusted-circle", getTrustedCircle);
router.post("/trusted-contacts", addTrustedContact);
router.put("/trusted-contacts/:contactId", updateTrustedContact);
router.delete("/trusted-contacts/:contactId", deleteTrustedContact);
router.patch("/trusted-circle/settings", updateTrustedCircleSettings);
router.post("/trusted-circle/test-alert", sendTestAlert);

export default router;
