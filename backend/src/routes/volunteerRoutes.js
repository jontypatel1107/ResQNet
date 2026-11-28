import express from "express";
import {
  getVolunteerProfile,
  updateVolunteerStatus,
  toggleDutyStatus,
  getNearbyRequests,
} from "../controllers/volunteerController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("volunteer", "admin"));

router.get("/profile", getVolunteerProfile);
router.put("/status", updateVolunteerStatus);
router.patch("/status", updateVolunteerStatus);
router.patch("/duty-status", toggleDutyStatus);
router.get("/nearby", getNearbyRequests);

export default router;
