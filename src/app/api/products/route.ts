import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

type ProductDocument = {
  name: string;
  normalizedName: string;
  createdAt: Date;
};

export async function GET() {
  try {
    const database = await getDatabase();
    const products = await database
      .collection<ProductDocument>("products")
      .find()
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({
      products: products.map((product) => ({
        id: product._id.toHexString(),
        name: product.name,
      })),
    });
  } catch {
    return NextResponse.json({ message: "Product catalog is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    typeof body.name !== "string"
  ) {
    return NextResponse.json({ message: "Invalid product details" }, { status: 400 });
  }

  const name = body.name.trim();

  if (!name) {
    return NextResponse.json({ message: "Product name is required" }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    const products = database.collection<ProductDocument>("products");
    await products.dropIndex("sku_1").catch(() => undefined);
    await products.createIndex({ normalizedName: 1 }, { unique: true });
    const product: ProductDocument = {
      name,
      normalizedName: name.toLocaleLowerCase("en-US"),
      createdAt: new Date(),
    };
    const result = await products.insertOne(product);

    return NextResponse.json(
      { product: { id: result.insertedId.toHexString(), ...product } },
      { status: 201 },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ message: "A product with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "Product catalog is unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    !("name" in body) ||
    typeof body.id !== "string" ||
    typeof body.name !== "string" ||
    !ObjectId.isValid(body.id)
  ) {
    return NextResponse.json({ message: "Invalid product details" }, { status: 400 });
  }

  const name = body.name.trim();
  if (!name) {
    return NextResponse.json({ message: "Product name is required" }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    const productId = new ObjectId(body.id);
    const products = database.collection<ProductDocument>("products");
    await products.createIndex({ normalizedName: 1 }, { unique: true });
    const result = await products.findOneAndUpdate(
      { _id: productId },
      { $set: { name, normalizedName: name.toLocaleLowerCase("en-US") } },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    await database.collection("inventory_items").updateMany(
      { productId },
      { $set: { product: name } },
    );

    return NextResponse.json({
      product: { id: result._id.toHexString(), name: result.name },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ message: "A product with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: "Product catalog is unavailable" }, { status: 503 });
  }
}