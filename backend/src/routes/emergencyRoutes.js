import express from "express";
import {
  createEmergency,
  getMyEmergencies,
  getEmergencyById,
  getPublicEmergencyTrack,
  cancelEmergency,
  pingEmergencyLocation,
} from "../controllers/emergencyController.js";
import {
  getEmergencyMessages,
  sendEmergencyMessage,
} from "../controllers/chatController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { createEmergencySchema } from "../validators/emergencyValidators.js";

const router = express.Router();

// Public live tracking endpoint (for trusted contacts opening SMS/WhatsApp alert link)
router.get("/track/:id", getPublicEmergencyTrack);

// Authenticated endpoints below
router.use(authenticate);

router.post("/", validate(createEmergencySchema), createEmergency);
router.get("/my", getMyEmergencies);
router.get("/:id", getEmergencyById);
router.post("/:id/location-ping", pingEmergencyLocation);
router.patch("/:id/cancel", cancelEmergency);

// Mission Chat endpoints
router.get("/:id/messages", getEmergencyMessages);
router.post("/:id/messages", sendEmergencyMessage);

export default router;
