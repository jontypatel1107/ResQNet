import express from "express";
import {
  getAdminStats,
  getAllUsers,
  toggleUserStatus,
  verifyVolunteer,
  getAllEmergencies,
  getAllIncidents,
  getTriageQueue,
  getEmergencyTriage,
  dispatchEmergency,
  cancelTriageTimer,
} from "../controllers/adminController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin"));

router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.patch("/users/:id/status", toggleUserStatus);
router.patch("/volunteers/:id/verify", verifyVolunteer);
router.get("/emergencies", getAllEmergencies);
router.get("/emergencies/triage-queue", getTriageQueue);
router.get("/emergencies/:id/triage", getEmergencyTriage);
router.post("/emergencies/:id/dispatch", dispatchEmergency);
router.post("/emergencies/:id/cancel-timer", cancelTriageTimer);
router.get("/incidents", getAllIncidents);

export default router;
