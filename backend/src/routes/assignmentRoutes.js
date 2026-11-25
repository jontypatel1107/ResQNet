import express from "express";
import {
  acceptAssignment,
  getMyAssignments,
  updateAssignmentStatus,
} from "../controllers/assignmentController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("volunteer", "admin"));

router.get("/my", getMyAssignments);
router.patch("/:id/accept", acceptAssignment);
router.patch("/:id/status", updateAssignmentStatus);

export default router;
