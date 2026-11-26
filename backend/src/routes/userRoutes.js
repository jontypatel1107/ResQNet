import express from "express";
import { getProfile, updateProfile } from "../controllers/userController.js";
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

router.use(authenticate);

// Profile
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// Trusted Circle & Emergency Contacts
router.get("/trusted-circle", getTrustedCircle);
router.post("/trusted-contacts", addTrustedContact);
router.put("/trusted-contacts/:contactId", updateTrustedContact);
router.delete("/trusted-contacts/:contactId", deleteTrustedContact);
router.patch("/trusted-circle/settings", updateTrustedCircleSettings);
router.post("/trusted-circle/test-alert", sendTestAlert);

export default router;
