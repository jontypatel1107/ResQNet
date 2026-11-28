import express from "express";
import {
  reportHazard,
  getHazards,
  clearHazard,
} from "../controllers/hazardController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", reportHazard);
router.get("/", getHazards);
router.patch("/:id/clear", clearHazard);

export default router;
