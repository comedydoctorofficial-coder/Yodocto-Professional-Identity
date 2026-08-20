import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateProfessionalBody,
  GetProfessionalBySlugParams,
  GetProfessionalParams,
  GetProfessionalActivityParams,
  UpdateProfessionalBody,
  UpdateProfessionalParams,
} from "@workspace/api-zod";
import {
  activitiesTable,
  db,
  professionalsTable,
  type ProfessionalRow,
} from "@workspace/db";

const router: IRouter = Router();

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function slugFor(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function identityId() {
  return `YD-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

function calculateCompletion(input: {
  name?: string;
  profession?: string;
  location?: string;
  summary?: string;
  skills?: string[];
  education?: unknown[];
  experience?: unknown[];
  interests?: string[];
  certifications?: string[];
  professionalRegistration?: string | null;
  practiceInformation?: string | null;
}) {
  const checks = [
    Boolean(input.name),
    Boolean(input.profession),
    Boolean(input.location),
    Boolean(input.summary),
    Boolean(input.skills?.length),
    Boolean(input.education?.length),
    Boolean(input.experience?.length),
    Boolean(input.interests?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function serialize(row: ProfessionalRow) {
  return {
    ...row,
    score: Number(row.score),
    completion: Number(row.completion),
    createdAt: row.createdAt.toISOString(),
  };
}

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugFor(name) || "professional";
  let slug = base;
  let count = 1;
  while (true) {
    const existing = await db
      .select({ id: professionalsTable.id })
      .from(professionalsTable)
      .where(eq(professionalsTable.slug, slug))
      .limit(1);
    if (!existing[0] || existing[0].id === excludeId) return slug;
    count += 1;
    slug = `${base}-${count}`;
  }
}

router.get("/professionals", async (req, res) => {
  const rows = await db
    .select()
    .from(professionalsTable)
    .orderBy(desc(professionalsTable.createdAt));
  req.log.info({ count: rows.length }, "Listed public professionals");
  res.json(rows.map(serialize));
});

router.post("/professionals", async (req, res) => {
  const parsed = CreateProfessionalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please check the profile details and try again." });
    return;
  }

  const input = parsed.data;
  const id = identityId();
  const slug = await uniqueSlug(input.name);
  const completion = calculateCompletion(input);
  const row = {
    id,
    name: input.name,
    slug,
    profession: input.profession,
    location: input.location,
    initials: initialsFor(input.name),
    imageUrl: input.imageUrl ?? null,
    company: input.company ?? null,
    companyLogoUrl: input.companyLogoUrl ?? null,
    score: String(Math.min(100, Math.max(18, completion + 10))),
    completion: String(completion),
    status: "open",
    summary: input.summary ?? "",
    skills: input.skills ?? [],
    education: input.education ?? [],
    experience: input.experience ?? [],
    interests: input.interests ?? [],
    certifications: input.certifications ?? [],
    professionalRegistration: input.professionalRegistration ?? null,
    practiceInformation: input.practiceInformation ?? null,
    resumeUrl: input.resumeUrl ?? null,
    resumeFileName: input.resumeFileName ?? null,
    resumeText: input.resumeText ?? null,
    qrValue: `/profile/${slug}`,
  };
  const [created] = await db.insert(professionalsTable).values(row).returning();
  await db.insert(activitiesTable).values({
    id: `${id}-created`,
    professionalId: id,
    label: "Yodocto identity created",
    detail: "Your professional page is ready to share.",
    date: "Just now",
  });
  req.log.info({ professionalId: id }, "Created professional identity");
  res.status(201).json(serialize(created));
});

router.get("/professionals/:id", async (req, res) => {
  const parsed = GetProfessionalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Yodocto ID." });
    return;
  }
  const [row] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.id, parsed.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Professional profile not found." });
    return;
  }
  res.json(serialize(row));
});

router.patch("/professionals/:id", async (req, res) => {
  const params = UpdateProfessionalParams.safeParse(req.params);
  const body = UpdateProfessionalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Please check the profile details and try again." });
    return;
  }
  const [current] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.id, params.data.id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Professional profile not found." });
    return;
  }
  const input = body.data;
  const name = input.name ?? current.name;
  const values = {
    ...(input.name === undefined ? {} : { name, initials: initialsFor(name), slug: await uniqueSlug(name, current.id) }),
    ...(input.profession === undefined ? {} : { profession: input.profession }),
    ...(input.location === undefined ? {} : { location: input.location }),
    ...(input.company === undefined ? {} : { company: input.company }),
    ...(input.summary === undefined ? {} : { summary: input.summary }),
    ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
    ...(input.companyLogoUrl === undefined ? {} : { companyLogoUrl: input.companyLogoUrl }),
    ...(input.skills === undefined ? {} : { skills: input.skills }),
    ...(input.education === undefined ? {} : { education: input.education }),
    ...(input.experience === undefined ? {} : { experience: input.experience }),
    ...(input.interests === undefined ? {} : { interests: input.interests }),
    ...(input.certifications === undefined ? {} : { certifications: input.certifications }),
    ...(input.professionalRegistration === undefined ? {} : { professionalRegistration: input.professionalRegistration }),
    ...(input.practiceInformation === undefined ? {} : { practiceInformation: input.practiceInformation }),
    ...(input.resumeUrl === undefined ? {} : { resumeUrl: input.resumeUrl }),
    ...(input.resumeFileName === undefined ? {} : { resumeFileName: input.resumeFileName }),
    ...(input.resumeText === undefined ? {} : { resumeText: input.resumeText }),
    ...(input.status === undefined ? {} : { status: input.status }),
  };
  const merged = { ...current, ...values };
  const [updated] = await db
    .update(professionalsTable)
    .set({
      ...values,
      completion: String(calculateCompletion(merged)),
      score: String(Math.min(100, Math.max(18, calculateCompletion(merged) + 10))),
      qrValue: `/profile/${merged.slug}`,
    })
    .where(eq(professionalsTable.id, current.id))
    .returning();
  await db.insert(activitiesTable).values({
    id: `${current.id}-${Date.now()}`,
    professionalId: current.id,
    label: "Profile updated",
    detail: "Your public identity reflects the latest changes.",
    date: "Just now",
  });
  res.json(serialize(updated));
});

router.get("/professionals/slug/:slug", async (req, res) => {
  const parsed = GetProfessionalBySlugParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile link." });
    return;
  }
  const [row] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.slug, parsed.data.slug))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Professional profile not found." });
    return;
  }
  res.json(serialize(row));
});

router.get("/professionals/:id/activity", async (req, res) => {
  const parsed = GetProfessionalActivityParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Yodocto ID." });
    return;
  }
  const rows = await db
    .select({
      id: activitiesTable.id,
      label: activitiesTable.label,
      detail: activitiesTable.detail,
      date: activitiesTable.date,
    })
    .from(activitiesTable)
    .where(eq(activitiesTable.professionalId, parsed.data.id))
    .orderBy(desc(activitiesTable.createdAt));
  res.json(rows);
});

export default router;