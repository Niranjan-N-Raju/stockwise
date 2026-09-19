import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import type { UserDocument } from "@/lib/users";

export async function GET() {
  try {
    const database = await getDatabase();
    const users = await database
      .collection<UserDocument>("users")
      .find({}, { projection: { username: 1 } })
      .sort({ username: 1 })
      .toArray();

    return NextResponse.json({ users: users.map((user) => user.username) });
  } catch {
    return NextResponse.json({ message: "Users are unavailable" }, { status: 503 });
  }
}