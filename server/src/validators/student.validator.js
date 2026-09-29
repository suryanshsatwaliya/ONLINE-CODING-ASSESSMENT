import { z } from "zod";
export const studentSchema = z.object({
  uid: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  course: z.string().min(1).max(120),
  section: z.string().min(1).max(120),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
