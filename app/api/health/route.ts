import { prisma } from "@/lib/db";

// Phase 0 verification endpoint: confirms the app can reach Postgres.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "connected" });
  } catch (error) {
    return Response.json(
      { ok: false, db: "error", message: String(error) },
      { status: 500 },
    );
  }
}
