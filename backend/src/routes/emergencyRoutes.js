import express from "express";
import {
  createEmergency,
  getMyEmergencies,
  getEmergencyById,
  cancelEmergency,
} from "../controllers/emergencyController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { createEmergencySchema } from "../validators/emergencyValidators.js";

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createEmergencySchema), createEmergency);
router.get("/my", getMyEmergencies);
router.get("/:id", getEmergencyById);
router.patch("/:id/cancel", cancelEmergency);

export default router;
