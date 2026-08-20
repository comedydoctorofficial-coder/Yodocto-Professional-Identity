import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const professionalsTable = pgTable("professionals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  profession: text("profession").notNull(),
  location: text("location").notNull(),
  initials: text("initials").notNull(),
  imageUrl: text("image_url"),
  company: text("company"),
  companyLogoUrl: text("company_logo_url"),
  score: text("score").notNull().default("0"),
  completion: text("completion").notNull().default("0"),
  status: text("status").notNull().default("open"),
  summary: text("summary").notNull().default(""),
  skills: jsonb("skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  education: jsonb("education")
    .$type<{ degree: string; institution: string; year: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  experience: jsonb("experience")
    .$type<{ role: string; organization: string; dates: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  interests: jsonb("interests").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  certifications: jsonb("certifications").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  professionalRegistration: text("professional_registration"),
  practiceInformation: text("practice_information"),
  resumeUrl: text("resume_url"),
  resumeFileName: text("resume_file_name"),
  resumeText: text("resume_text"),
  qrValue: text("qr_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activitiesTable = pgTable("professional_activities", {
  id: text("id").primaryKey(),
  professionalId: text("professional_id")
    .notNull()
    .references(() => professionalsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  detail: text("detail").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalSchema = createInsertSchema(professionalsTable);
export type InsertProfessional = z.infer<typeof insertProfessionalSchema>;
export type ProfessionalRow = typeof professionalsTable.$inferSelect;
export type ActivityRow = typeof activitiesTable.$inferSelect;