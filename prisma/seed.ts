import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS = [
  { slug: "math", name: "Mathematics", nameTh: "คณิตศาสตร์", colorHex: "#FFB800", description: "Algebra, geometry, calculus problem solving." },
  { slug: "physics", name: "Physics", nameTh: "ฟิสิกส์", colorHex: "#38BDF8", description: "Mechanics, waves, electricity." },
  { slug: "chemistry", name: "Chemistry", nameTh: "เคมี", colorHex: "#34D399", description: "Atoms, reactions, stoichiometry." },
  { slug: "english", name: "English", nameTh: "ภาษาอังกฤษ", colorHex: "#F472B6", description: "Grammar, reading, writing practice." },
  { slug: "biology", name: "Biology", nameTh: "ชีววิทยา", colorHex: "#A78BFA", description: "Cells, genetics, ecology." },
];

const LESSONS: { subject: string; title: string; titleTh: string; level: string; body: string; order: number }[] = [
  { subject: "math", title: "Linear equations", titleTh: "สมการเชิงเส้น", level: "BEGINNER", body: "Solve ax + b = c by isolating x step by step.", order: 1 },
  { subject: "math", title: "Quadratic equations", titleTh: "สมการกำลังสอง", level: "INTERMEDIATE", body: "Factor, complete the square, or use the quadratic formula.", order: 2 },
  { subject: "physics", title: "Newton's laws", titleTh: "กฎการเคลื่อนที่ของนิวตัน", level: "BEGINNER", body: "Inertia, F = ma, action-reaction pairs.", order: 1 },
  { subject: "english", title: "Present perfect", titleTh: "ปัจจุบันสมบูรณ์", level: "BEGINNER", body: "have/has + past participle for experiences and results.", order: 1 },
];

async function main() {
  for (const s of SUBJECTS) {
    await prisma.subject.upsert({ where: { slug: s.slug }, update: {}, create: s });
  }
  for (const l of LESSONS) {
    const exists = await prisma.lesson.findFirst({ where: { subjectSlug: l.subject, title: l.title } });
    if (!exists) {
      await prisma.lesson.create({ data: { ...l, level: l.level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" } });
    }
  }
  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
