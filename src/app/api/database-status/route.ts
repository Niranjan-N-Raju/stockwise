import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });

    const uri = process.env.MONGODB_URI ?? "";
    const host = uri.match(/@([^/?]+)/)?.[1] ?? "MongoDB server";

    return NextResponse.json({
      connected: true,
      provider: uri.startsWith("mongodb+srv://") ? "MongoDB Atlas" : "MongoDB",
      database: database.databaseName,
      host,
    });
  } catch {
    return NextResponse.json(
      { connected: false, provider: "MongoDB", message: "Connection unavailable" },
      { status: 503 },
    );
  }
}