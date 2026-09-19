import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

type ProductDocument = {
  name: string;
};

type InventoryItemDocument = {
  productId: ObjectId;
  product: string;
  quantity: number;
  expiryDate: string;
};

const DAY_IN_MS = 86_400_000;

function daysUntil(expiryDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${expiryDate}T00:00:00`).getTime() - today.getTime()) / DAY_IN_MS);
}

function serializeItems(items: (InventoryItemDocument & { _id: ObjectId })[]) {
  return items
    .map((item) => {
      const daysToExpiry = daysUntil(item.expiryDate);
      const isFefo = !items.some(
        (candidate) =>
          candidate.productId.equals(item.productId) &&
          candidate.quantity > 0 &&
          daysUntil(candidate.expiryDate) >= 0 &&
          candidate.expiryDate < item.expiryDate,
      );

      return {
        id: item._id.toHexString(),
        product: item.product,
        quantity: item.quantity,
        expiryDate: item.expiryDate,
        daysToExpiry,
        isFefo,
      };
    });
}

async function readItems() {
  const database = await getDatabase();
  return database
    .collection<InventoryItemDocument>("inventory_items")
    .find({ quantity: { $gt: 0 } })
    .sort({ expiryDate: 1 })
    .toArray();
}

export async function GET() {
  try {
    return NextResponse.json({ items: serializeItems(await readItems()) });
  } catch {
    return NextResponse.json({ message: "Inventory database is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (
    typeof body !== "object" ||
    body === null ||
    !("productId" in body) ||
    !("quantity" in body) ||
    !("expiryDate" in body) ||
    typeof body.productId !== "string" ||
    typeof body.quantity !== "number" ||
    !Number.isInteger(body.quantity) ||
    body.quantity <= 0 ||
    typeof body.expiryDate !== "string" ||
    Number.isNaN(Date.parse(body.expiryDate))
  ) {
    return NextResponse.json({ message: "Invalid inventory details" }, { status: 400 });
  }

  if (!ObjectId.isValid(body.productId)) {
    return NextResponse.json({ message: "Select a valid predefined product" }, { status: 400 });
  }

  try {
    const database = await getDatabase();
    const product = await database
      .collection<ProductDocument>("products")
      .findOne({ _id: new ObjectId(body.productId) });

    if (!product) {
      return NextResponse.json({ message: "Selected product was not found" }, { status: 404 });
    }

    const item: InventoryItemDocument = {
      productId: product._id,
      product: product.name,
      quantity: body.quantity,
      expiryDate: body.expiryDate,
    };
    const collection = database.collection<InventoryItemDocument>("inventory_items");
    await collection.dropIndex("sku_1_expiryDate_1").catch(() => undefined);
    await collection.createIndex({ productId: 1, expiryDate: 1 }, { unique: true });
    const result = await collection.findOneAndUpdate(
      { productId: item.productId, expiryDate: item.expiryDate },
      {
        $inc: { quantity: item.quantity },
        $set: { product: item.product },
        $setOnInsert: { productId: item.productId, expiryDate: item.expiryDate },
      },
      { upsert: true, returnDocument: "after" },
    );

    return NextResponse.json(
      { item: result ? serializeItems([result])[0] : null },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ message: "Inventory database is unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string"
  ) {
    return NextResponse.json({ message: "Invalid stock usage" }, { status: 400 });
  }

  const action = "action" in body && body.action === "dump" ? "dump" : "use";
  const quantity = "quantity" in body ? body.quantity : undefined;

  if (
    action === "use" &&
    (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0)
  ) {
    return NextResponse.json({ message: "Invalid stock usage" }, { status: 400 });
  }

  if (!ObjectId.isValid(body.id)) {
    return NextResponse.json({ message: "Inventory item not found" }, { status: 404 });
  }

  try {
    const database = await getDatabase();
    const collection = database.collection<InventoryItemDocument>("inventory_items");
    const itemId = new ObjectId(body.id);
    const item = await collection.findOne({ _id: itemId });

    if (!item) {
      return NextResponse.json({ message: "Inventory item not found" }, { status: 404 });
    }

    if (action === "dump") {
      if (daysUntil(item.expiryDate) >= 0) {
        return NextResponse.json({ message: "Only expired stock can be dumped" }, { status: 409 });
      }

      const dumpedItem = await collection.findOneAndUpdate(
        { _id: itemId, quantity: { $gt: 0 } },
        { $set: { quantity: 0 } },
        { returnDocument: "before" },
      );

      if (!dumpedItem) {
        return NextResponse.json({ message: "This stock was already removed" }, { status: 409 });
      }

      await database.collection("dumped_inventory").insertOne({
        inventoryItemId: dumpedItem._id,
        productId: dumpedItem.productId,
        product: dumpedItem.product,
        expiryDate: dumpedItem.expiryDate,
        quantity: dumpedItem.quantity,
        dumpedAt: new Date(),
      });

      return NextResponse.json({ items: serializeItems(await readItems()) });
    }

    if (daysUntil(item.expiryDate) < 0) {
      return NextResponse.json({ message: "Expired stock cannot be used" }, { status: 409 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const fefoItem = await collection.findOne(
      { productId: item.productId, quantity: { $gt: 0 }, expiryDate: { $gte: today } },
      { sort: { expiryDate: 1 } },
    );

    if (fefoItem && !fefoItem._id.equals(itemId)) {
      return NextResponse.json(
        { message: `Use stock expiring ${fefoItem.expiryDate} first` },
        { status: 409 },
      );
    }

    const updatedItem = await collection.findOneAndUpdate(
      { _id: itemId, quantity: { $gte: quantity as number } },
      { $inc: { quantity: -(quantity as number) } },
      { returnDocument: "after" },
    );

    if (!updatedItem) {
      return NextResponse.json({ message: "Not enough stock for this expiry date" }, { status: 400 });
    }

    return NextResponse.json({ items: serializeItems(await readItems()) });
  } catch {
    return NextResponse.json({ message: "Inventory database is unavailable" }, { status: 503 });
  }
}