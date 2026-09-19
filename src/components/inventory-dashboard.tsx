"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown, faPencil, faXmark } from "@fortawesome/free-solid-svg-icons";

type InventoryItem = {
  id: string;
  product: string;
  quantity: number;
  expiryDate: string;
  daysToExpiry: number;
  isFefo: boolean;
};

type Product = {
  id: string;
  name: string;
};

type Filter = "all" | "expired" | "critical" | "healthy";

function expiryLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Expires today";
  return `${days}d remaining`;
}

function statusFor(days: number) {
  if (days < 0) return { label: "Expired", className: "bg-[#fce8e6] text-[#a63232]" };
  if (days <= 7) return { label: "Use now", className: "bg-[#fff0d6] text-[#8a4b08]" };
  if (days <= 30) return { label: "Expiring soon", className: "bg-[#fff8d8] text-[#75610b]" };
  return { label: "Healthy", className: "bg-[#e7f2ea] text-[#27613e]" };
}

export function InventoryDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [productError, setProductError] = useState("");
  const [productName, setProductName] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const [stockProductError, setStockProductError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showProducts, setShowProducts] = useState(false);

  async function loadInventory() {
    const response = await fetch("/api/inventory", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load inventory");
    const data: { items: InventoryItem[] } = await response.json();
    setItems(data.items);
  }

  async function loadProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load products");
    const data: { products: Product[] } = await response.json();
    setProducts(data.products);
  }

  useEffect(() => {
    Promise.all([loadInventory(), loadProducts()])
      .catch(() => setMessage("Inventory or products could not be loaded."))
      .finally(() => setIsLoading(false));
  }, []);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = productName.trim();

    if (!name) {
      setProductError("Product name is required.");
      return;
    }

    setProductError("");
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
      }),
    });

    const data: { product?: Product; message?: string } = await response.json();
    if (!response.ok) {
      setProductError(data.message ?? "Product could not be added.");
      return;
    }

    setProductName("");
    setProductError("");
    setMessage(`${data.product?.name ?? "Product"} added to the catalog.`);
    await loadProducts();
  }

  async function updateProduct(product: Product) {
    const name = editName.trim();
    if (!name) {
      setEditError("Product name is required.");
      return;
    }

    setEditError("");
    const response = await fetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id, name }),
    });
    const data: { product?: Product; message?: string } = await response.json();

    if (!response.ok) {
      setEditError(data.message ?? "Product could not be updated.");
      return;
    }

    setEditingProduct(null);
    setEditName("");
    setMessage(`${data.product?.name ?? "Product"} updated.`);
    await Promise.all([loadProducts(), loadInventory()]);
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!selectedProductId) {
      setStockProductError("Select a product from the list.");
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selectedProductId,
        quantity: Number(formData.get("quantity")),
        expiryDate: formData.get("expiryDate"),
      }),
    });

    if (!response.ok) {
      const data: { message?: string } = await response.json();
      setMessage(data.message ?? "Inventory could not be added.");
      return;
    }

    form.reset();
    setProductQuery("");
    setSelectedProductId("");
    setStockProductError("");
    setIsAdding(false);
    setMessage("Stock added to the FEFO queue.");
    await loadInventory();
  }

  async function useOne(item: InventoryItem) {
    setMessage("");
    const response = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, quantity: 1 }),
    });

    const data: { items?: InventoryItem[]; message?: string } = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Stock could not be updated.");
      return;
    }

    setItems(data.items ?? []);
    setMessage(`Used 1 unit expiring ${item.expiryDate}.`);
  }

  async function dumpExpired(item: InventoryItem) {
    if (!window.confirm(`Mark all ${item.quantity} units of ${item.product} as dumped?`)) {
      return;
    }

    setMessage("");
    const response = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "dump" }),
    });
    const data: { items?: InventoryItem[]; message?: string } = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? "Expired stock could not be marked as dumped.");
      return;
    }

    setItems(data.items ?? []);
    setMessage(`${item.quantity} units of ${item.product} marked as dumped.`);
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productQuery.trim().toLowerCase()),
  );

  function selectProduct(product: Product) {
    setSelectedProductId(product.id);
    setProductQuery(product.name);
    setProductPickerOpen(false);
    setStockProductError("");
  }

  function handleProductKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setProductPickerOpen(true);
      setHighlightedProductIndex((current) =>
        filteredProducts.length ? (current + 1) % filteredProducts.length : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setProductPickerOpen(true);
      setHighlightedProductIndex((current) =>
        filteredProducts.length ? (current - 1 + filteredProducts.length) % filteredProducts.length : 0,
      );
    } else if (event.key === "Enter" && productPickerOpen && filteredProducts.length) {
      event.preventDefault();
      selectProduct(filteredProducts[highlightedProductIndex] ?? filteredProducts[0]);
    } else if (event.key === "Escape") {
      setProductPickerOpen(false);
    }
  }

  const visibleItems = items.filter((item) => {
    const matchesSearch =
      !normalizedSearch ||
      item.product.toLowerCase().includes(normalizedSearch);
    const matchesFilter =
      filter === "all" ||
      (filter === "expired" && item.daysToExpiry < 0) ||
      (filter === "critical" && item.daysToExpiry >= 0 && item.daysToExpiry <= 30) ||
      (filter === "healthy" && item.daysToExpiry > 30);
    return matchesSearch && matchesFilter;
  });

  const expiredCount = items.filter((item) => item.daysToExpiry < 0).length;
  const criticalCount = items.filter(
    (item) => item.daysToExpiry >= 0 && item.daysToExpiry <= 7,
  ).length;
  const expiringUnits = items
    .filter((item) => item.daysToExpiry >= 0 && item.daysToExpiry <= 30)
    .reduce((total, item) => total + item.quantity, 0);
  const totalUnits = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <main className="min-h-screen bg-[#f4f6f3] text-[#17251d]">
      <header className="border-b border-[#d8ddd5] bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#2f6948]">Stockwise</p>
            <p className="text-xs text-[#738078]">FEFO inventory control</p>
          </div>
          <button type="button" onClick={onSignOut} className="text-sm font-semibold text-[#526158] hover:text-[#17251d]">
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[#397052]">Inventory overview</p>
            <h1 className="mt-1 text-3xl font-semibold">Expiry control center</h1>
            <p className="mt-2 text-sm text-[#68766d]">Stock is ordered by earliest expiry first.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setProductError("");
                setProductName("");
                setEditingProduct(null);
                setEditName("");
                setEditError("");
                setShowProducts(true);
              }}
              className="h-11 border border-[#8eaa96] bg-white px-5 text-sm font-semibold text-[#28573c] hover:bg-[#eaf2ec]"
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => {
                setProductQuery("");
                setSelectedProductId("");
                setStockProductError("");
                setHighlightedProductIndex(0);
                setIsAdding(true);
              }}
              className="h-11 bg-[#224c35] px-5 text-sm font-semibold text-white hover:bg-[#173b29]"
            >
              + Receive stock
            </button>
          </div>
        </div>

        <section className="mt-8 grid border border-[#d8ddd5] bg-white sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Expired items", expiredCount, "text-[#a63232]"],
            ["Use within 7 days", criticalCount, "text-[#a35b0d]"],
            ["Units expiring in 30d", expiringUnits, "text-[#75610b]"],
            ["Total units", totalUnits, "text-[#27613e]"],
          ].map(([label, value, color], index) => (
            <div key={label} className={`p-5 ${index > 0 ? "border-t border-[#e1e5df] sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t lg:border-l lg:border-t-0" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#748078]">{label}</p>
              <p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 border border-[#d8ddd5] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#e1e5df] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1" aria-label="Inventory filters">
              {(["all", "expired", "critical", "healthy"] as Filter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`h-9 px-3 text-sm font-semibold capitalize ${filter === option ? "bg-[#dce9df] text-[#224c35]" : "text-[#637168] hover:bg-[#f1f4f1]"}`}
                >
                  {option === "critical" ? "Expiring ≤30d" : option}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product"
              aria-label="Search inventory"
              className="h-10 w-full border border-[#c8d0c9] bg-white px-3 text-sm outline-none focus:border-[#397052] lg:w-72"
            />
          </div>

          {message && <p className="border-b border-[#e1e5df] bg-[#f7f9f6] px-4 py-3 text-sm font-medium text-[#405248]" aria-live="polite">{message}</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[#f7f9f6] text-xs uppercase tracking-[0.08em] text-[#69766e]">
                <tr>
                  {['Priority', 'Product', 'Expiry', 'Quantity', 'Action'].map((heading) => (
                    <th key={heading} className="border-b border-[#dfe4de] px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item, index) => {
                  const status = statusFor(item.daysToExpiry);
                  return (
                    <tr key={item.id} className="border-b border-[#e7eae6] last:border-0 hover:bg-[#fafbf9]">
                      <td className="px-4 py-4 font-semibold text-[#397052]">#{String(index + 1).padStart(2, "0")}</td>
                      <td className="px-4 py-4 font-semibold">{item.product}</td>
                      <td className="px-4 py-4"><span className={`inline-block px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span><p className="mt-1.5 text-xs text-[#69766e]">{item.expiryDate} · {expiryLabel(item.daysToExpiry)}</p></td>
                      <td className="px-4 py-4 text-base font-semibold">{item.quantity}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => item.daysToExpiry < 0 ? dumpExpired(item) : useOne(item)}
                          disabled={item.daysToExpiry >= 0 && !item.isFefo}
                          title={!item.isFefo ? "Use stock with the earlier expiry date first" : undefined}
                          className={`h-9 border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:border-[#d7dcd7] disabled:text-[#a3aca6] ${item.daysToExpiry < 0 ? "border-[#d89a96] text-[#a63232] hover:bg-[#fce8e6]" : "border-[#8eaa96] text-[#28573c] hover:bg-[#eaf2ec]"}`}
                        >
                          {item.daysToExpiry < 0 ? "Mark dumped" : item.isFefo ? "Use 1" : "FEFO locked"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isLoading && visibleItems.length === 0 && <p className="p-10 text-center text-sm text-[#68766d]">No inventory items match this view.</p>}
          {isLoading && <p className="p-10 text-center text-sm text-[#68766d]">Loading inventory...</p>}
        </section>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17251d]/55 p-4" role="presentation" onMouseDown={() => setIsAdding(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="receive-stock-title"
            className="w-full max-w-xl border border-[#cbd4cc] bg-white shadow-[0_24px_80px_rgba(10,25,16,0.28)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#e1e5df] p-5">
              <div>
                <h2 id="receive-stock-title" className="text-xl font-semibold">Receive stock</h2>
                <p className="mt-1 text-sm text-[#68766d]">The same product and expiry date are combined.</p>
              </div>
              <button type="button" onClick={() => setIsAdding(false)} aria-label="Close receive stock" className="h-9 w-9 text-xl text-[#526158] hover:bg-[#f1f4f1]">×</button>
            </div>

            <form onSubmit={addItem} className="p-5">
              <div className="grid gap-4">
                <div className="relative">
                  <label htmlFor="stock-product" className="text-xs font-semibold text-[#526158]">Product</label>
                  <div className="relative mt-2">
                    <input
                      id="stock-product"
                      type="text"
                      role="combobox"
                      autoComplete="off"
                      autoFocus
                      value={productQuery}
                      aria-expanded={productPickerOpen}
                      aria-controls="stock-product-options"
                      aria-autocomplete="list"
                      aria-invalid={Boolean(stockProductError)}
                      placeholder="Search products"
                      onFocus={() => setProductPickerOpen(true)}
                      onBlur={() => window.setTimeout(() => setProductPickerOpen(false), 100)}
                      onKeyDown={handleProductKeyDown}
                      onChange={(event) => {
                        setProductQuery(event.target.value);
                        setSelectedProductId("");
                        setHighlightedProductIndex(0);
                        setProductPickerOpen(true);
                        setStockProductError("");
                      }}
                      className={`h-11 w-full border bg-white px-3 pr-10 text-sm text-[#17251d] outline-none focus:ring-2 ${stockProductError ? "border-[#c43d3d] focus:ring-[#c43d3d]/20" : "border-[#c8d0c9] focus:border-[#397052] focus:ring-[#397052]/20"}`}
                    />
                    <button type="button" tabIndex={-1} aria-label="Show products" onMouseDown={(event) => event.preventDefault()} onClick={() => setProductPickerOpen((current) => !current)} className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[#68766d]">
                      <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
                    </button>
                  </div>
                  {stockProductError && <p className="mt-1.5 text-xs font-medium text-[#b3261e]">{stockProductError}</p>}
                  {productPickerOpen && (
                    <div id="stock-product-options" role="listbox" className="absolute z-10 mt-1 max-h-52 w-full overflow-auto border border-[#c8d0c9] bg-white shadow-lg">
                      {filteredProducts.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          role="option"
                          aria-selected={selectedProductId === product.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectProduct(product)}
                          className={`block w-full px-3 py-2.5 text-left text-sm ${index === highlightedProductIndex ? "bg-[#eaf2ec] text-[#28573c]" : "hover:bg-[#f4f6f3]"}`}
                        >
                          {product.name}
                        </button>
                      ))}
                      {filteredProducts.length === 0 && <p className="px-3 py-4 text-center text-sm text-[#68766d]">No matching products</p>}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#526158]">
                    Quantity
                    <input name="quantity" type="number" placeholder="12" min="1" required className="mt-2 h-11 w-full border border-[#c8d0c9] px-3 text-sm outline-none focus:border-[#397052]" />
                  </label>
                  <label className="text-xs font-semibold text-[#526158]">
                    Expiry date
                    <input name="expiryDate" type="date" required className="mt-2 h-11 w-full border border-[#c8d0c9] px-3 text-sm outline-none focus:border-[#397052]" />
                  </label>
                </div>
              </div>
              {products.length === 0 && <p className="mt-4 text-sm font-medium text-[#a63232]">Add a product before receiving stock.</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="h-11 px-4 text-sm font-semibold text-[#526158] hover:bg-[#f1f4f1]">Cancel</button>
                <button type="submit" disabled={products.length === 0} className="h-11 bg-[#224c35] px-5 text-sm font-semibold text-white hover:bg-[#173b29] disabled:cursor-not-allowed disabled:opacity-50">Add stock</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showProducts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17251d]/55 p-4" role="presentation" onMouseDown={() => setShowProducts(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="products-title"
            className="w-full max-w-lg border border-[#cbd4cc] bg-white shadow-[0_24px_80px_rgba(10,25,16,0.28)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#e1e5df] p-5">
              <div>
                <h2 id="products-title" className="text-xl font-semibold">Products</h2>
                <p className="mt-1 text-sm text-[#68766d]">Create the predefined names used for stock entry.</p>
              </div>
              <button type="button" onClick={() => setShowProducts(false)} aria-label="Close products" className="h-9 w-9 text-xl text-[#526158] hover:bg-[#f1f4f1]">×</button>
            </div>

            <form onSubmit={addProduct} noValidate className="border-b border-[#e1e5df] p-5">
              <div>
                <label htmlFor="product-name" className="text-xs font-semibold text-[#526158]">Product name</label>
                <input
                  id="product-name"
                  name="name"
                  placeholder="Product Name"
                  autoFocus
                  value={productName}
                  aria-invalid={Boolean(productError)}
                  aria-describedby={productError ? "product-name-error" : undefined}
                  onChange={(event) => {
                    setProductName(event.target.value);
                    setProductError("");
                  }}
                  className={`mt-2 h-11 w-full border px-3 text-sm outline-none focus:ring-2 ${productError ? "border-[#c43d3d] focus:border-[#c43d3d] focus:ring-[#c43d3d]/20" : "border-[#c8d0c9] focus:border-[#397052] focus:ring-[#397052]/20"}`}
                />
                {productError && <p id="product-name-error" className="mt-1.5 text-xs font-medium text-[#b3261e]">{productError}</p>}
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" className="h-11 bg-[#224c35] px-5 text-sm font-semibold text-white hover:bg-[#173b29]">Add product</button>
              </div>
            </form>

            <div className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Product catalog</h3>
                <span className="text-sm text-[#68766d]">{products.length} products</span>
              </div>
              <div className="mt-3 max-h-64 overflow-auto border border-[#e1e5df]">
                {products.map((product) => (
                  <div key={product.id} className="border-b border-[#e7eae6] px-4 py-2 last:border-0">
                    {editingProduct?.id === product.id ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={(event) => { setEditName(event.target.value); setEditError(""); }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") updateProduct(product);
                              if (event.key === "Escape") setEditingProduct(null);
                            }}
                            aria-label={`Edit ${product.name}`}
                            aria-invalid={Boolean(editError)}
                            className={`h-9 min-w-0 flex-1 border px-3 text-sm outline-none focus:ring-2 ${editError ? "border-[#c43d3d] focus:ring-[#c43d3d]/20" : "border-[#397052] focus:ring-[#397052]/20"}`}
                            autoFocus
                          />
                          <button type="button" onClick={() => updateProduct(product)} aria-label="Save product name" title="Save" className="flex h-9 w-9 items-center justify-center text-[#28573c] hover:bg-[#eaf2ec]">
                            <FontAwesomeIcon icon={faCheck} />
                          </button>
                          <button type="button" onClick={() => { setEditingProduct(null); setEditName(""); setEditError(""); }} aria-label="Cancel editing" title="Cancel" className="flex h-9 w-9 items-center justify-center text-[#69766e] hover:bg-[#f1f4f1]">
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        </div>
                        {editError && <p className="mt-1.5 text-xs font-medium text-[#b3261e]">{editError}</p>}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{product.name}</p>
                        <button
                          type="button"
                          aria-label={`Edit ${product.name}`}
                          title="Edit product"
                          onClick={() => {
                            setEditingProduct(product);
                            setEditName(product.name);
                            setEditError("");
                          }}
                          className="flex h-9 w-9 items-center justify-center text-[#526158] hover:bg-[#eaf2ec] hover:text-[#28573c]"
                        >
                          <FontAwesomeIcon icon={faPencil} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {products.length === 0 && <p className="p-6 text-center text-sm text-[#68766d]">Add your first product to begin receiving stock.</p>}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}