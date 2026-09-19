import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import type { UserDocument } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("username" in body) ||
      !("password" in body) ||
      typeof body.username !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid request" },
        { status: 400 },
      );
    }

    const database = await getDatabase();
    const user = await database
      .collection<UserDocument>("users")
      .findOne({ username: body.username.trim() });
    const isValid = user && (await bcrypt.compare(body.password, user.passwordHash));

    if (isValid) {
      return NextResponse.json({ success: true, user: { username: user.username, role: user.role } });
    }

    return NextResponse.json(
      { success: false, message: "Invalid credentials" },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Authentication service is unavailable" },
      { status: 503 },
    );
  }
}