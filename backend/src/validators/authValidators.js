import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(60),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(8, "Phone number must be at least 8 digits"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["citizen", "volunteer"]).default("citizen"),
    skills: z.array(z.string()).optional(),
    serviceRadius: z.number().min(1).max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
  }),
});
