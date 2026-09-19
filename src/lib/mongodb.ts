import { Db, MongoClient, ServerApiVersion } from "mongodb";

const globalWithMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB ?? "inventory_management";

  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!globalWithMongo.mongoClientPromise) {
    globalWithMongo.mongoClientPromise = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    }).connect();
  }

  try {
    const client = await globalWithMongo.mongoClientPromise;
    return client.db(databaseName);
  } catch (error) {
    globalWithMongo.mongoClientPromise = undefined;
    throw error;
  }
}