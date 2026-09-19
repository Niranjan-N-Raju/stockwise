import bcrypt from "bcryptjs";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "inventory_management";
const username = process.env.SEED_USERNAME ?? "admin";
const password = process.env.SEED_PASSWORD ?? "inventory123";

if (!uri) {
  throw new Error("MONGODB_URI is not configured");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

try {
  await client.connect();
  const users = client.db(databaseName).collection("users");
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 12);

  await users.createIndex({ username: 1 }, { unique: true });
  const result = await users.updateOne(
    { username },
    {
      $set: { passwordHash, role: "admin", updatedAt: now },
      $setOnInsert: { username, createdAt: now },
    },
    { upsert: true },
  );

  console.log(result.upsertedCount ? `Created user: ${username}` : `Updated user: ${username}`);
} finally {
  await client.close();
}