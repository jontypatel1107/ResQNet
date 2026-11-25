import { z } from "zod";

export const createEmergencySchema = z.object({
  body: z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(5).max(1000),
    category: z.enum([
      "medical",
      "rescue",
      "food",
      "water",
      "transportation",
      "other",
    ]),
    priority: z.enum(["critical", "high", "medium", "normal"]).default("medium"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
    images: z.array(z.string()).optional(),
  }),
});
