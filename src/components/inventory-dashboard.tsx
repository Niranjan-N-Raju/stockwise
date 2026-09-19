"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown, faCircleExclamation, faCircleNotch, faClock, faPencil, faXmark } from "@fortawesome/free-solid-svg-icons";

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
type Toast = { message: string; type: "success" | "error" };

function expiryLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Expires today";
  return `${days}d remaining`;
}

function statusFor(days: number) {
  if (days < 0) return { label: "Expired", className: "bg-[var(--pb-peach)] text-[#9c3f00]" };
  if (days <= 7) return { label: "Use now", className: "bg-[var(--pb-yellow)] text-[#594600]" };
  if (days <= 30) return { label: "Expiring soon", className: "bg-[var(--pb-wheat)] text-[#68520a]" };
  return { label: "Healthy", className: "bg-[#d9f3f5] text-[#006b7f]" };
}

export function InventoryDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [multipleItem, setMultipleItem] = useState<InventoryItem | null>(null);
  const [useQuantity, setUseQuantity] = useState("");
  const [useQuantityError, setUseQuantityError] = useState("");
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

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  async function useStock(item: InventoryItem, quantity: number) {
    setUpdatingItemId(item.id);
    setToast(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, quantity }),
      });

      const data: { items?: InventoryItem[]; message?: string } = await response.json();
      if (!response.ok) {
        setToast({ message: data.message ?? "Stock could not be updated.", type: "error" });
        return false;
      }

      setItems(data.items ?? []);
      setToast({ message: `Used ${quantity} unit${quantity === 1 ? "" : "s"} of ${item.product} expiring ${item.expiryDate}.`, type: "success" });
      return true;
    } catch {
      setToast({ message: "Stock could not be updated.", type: "error" });
      return false;
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function useMultiple(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!multipleItem) return;

    const quantity = Number(useQuantity);
    if (!Number.isInteger(quantity) || quantity < 2) {
      setUseQuantityError("Enter a whole number of at least 2.");
      return;
    }
    if (quantity > multipleItem.quantity) {
      setUseQuantityError(`Only ${multipleItem.quantity} units are available.`);
      return;
    }

    setUseQuantityError("");
    if (await useStock(multipleItem, quantity)) {
      setMultipleItem(null);
      setUseQuantity("");
    }
  }

  function openUseMultiple(item: InventoryItem) {
    setMultipleItem(item);
    setUseQuantity("");
    setUseQuantityError("");
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
  const expiresTomorrowCount = items.filter((item) => item.daysToExpiry === 1).length;
  const summaryItems = [
    { label: "Expired items", value: expiredCount, note: "Needs disposal", icon: faCircleExclamation, accent: "bg-[var(--pb-orange)]", valueColor: "text-[#b44700]", blink: false },
    { label: "Expires in 1 day", value: expiresTomorrowCount, note: "Immediate action", icon: faCircleExclamation, accent: "bg-[var(--pb-cyan)]", valueColor: "text-[#007c93]", blink: expiresTomorrowCount > 0 },
    { label: "Use within 7 days", value: criticalCount, note: "Highest priority", icon: faClock, accent: "bg-[var(--pb-yellow)]", valueColor: "text-[#9a7100]", blink: false },
    { label: "Expiring in 30 days", value: expiringUnits, note: "Units at risk", icon: faClock, accent: "bg-[var(--pb-wheat)]", valueColor: "text-[#806311]", blink: false },
  ];

  return (
    <main className="min-h-screen bg-[#f8f7f1] text-[#1f292b]">
      <header className="border-b border-[var(--pb-stone)] bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--pb-orange)]">Stockwise</p>
            <p className="text-xs text-[#667174]">FEFO inventory control</p>
          </div>
          <button type="button" onClick={onSignOut} className="text-sm font-semibold text-[#526158] hover:text-[#17251d]">
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">
        <div>
          <div>
            <p className="text-sm font-semibold text-[var(--pb-cyan)]">Inventory overview</p>
            <h1 className="mt-1 text-3xl font-semibold">Expiry control center</h1>
            <p className="mt-2 text-sm text-[#68766d]">Stock is ordered by earliest expiry first.</p>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 lg:grid-cols-4 lg:gap-3" aria-label="Inventory summary">
          {summaryItems.map((item) => (
            <div key={item.label} className={`relative overflow-hidden border border-[var(--pb-stone)] bg-white p-3.5 shadow-[0_2px_8px_rgba(31,41,43,0.05)] sm:px-4 sm:py-3.5 ${item.blink ? "expiry-alert-blink" : ""}`}>
              <span className={`absolute inset-x-0 top-0 h-0.5 ${item.accent}`} />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#667174] sm:text-[11px]">{item.label}</p>
                  <p className={`mt-1 text-2xl font-bold sm:text-3xl ${item.valueColor}`}>{item.value}</p>
                </div>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${item.accent} ${item.label === "Use within 7 days" || item.label === "Expiring in 30 days" ? "text-[#4d3b00]" : "text-white"}`}>
                  <FontAwesomeIcon icon={item.icon} className="text-sm" />
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#7a8385]">{item.note}</p>
            </div>
          ))}
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
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
            className="h-11 border border-[var(--pb-cyan)] bg-white px-3 text-sm font-semibold text-[#007c93] hover:bg-[#e2f7f9] sm:px-5"
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
            className="h-11 bg-[var(--pb-orange)] px-3 text-sm font-semibold text-white hover:brightness-90 sm:px-5"
          >
            + Add / update stock
          </button>
        </div>

        <section className="mt-6 border border-[#d8ddd5] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#e1e5df] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1" aria-label="Inventory filters">
              {(["all", "expired", "critical", "healthy"] as Filter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`h-9 px-3 text-sm font-semibold capitalize ${filter === option ? "bg-[var(--pb-yellow)] text-[#493900]" : "text-[#667174] hover:bg-[var(--pb-stone)]"}`}
                >
                  {option === "critical" ? "Expiring ≤30d" : option}
                </button>
              ))}
            </div>
            <input
              type="search"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product"
              aria-label="Search inventory"
              className="h-10 w-full border border-[var(--pb-stone)] bg-white px-3 text-sm outline-none focus:border-[var(--pb-cyan)] lg:w-72"
            />
          </div>

          {message && <p className="border-b border-[#e1e5df] bg-[#f7f9f6] px-4 py-3 text-sm font-medium text-[#405248]" aria-live="polite">{message}</p>}

          <div className="space-y-3 bg-[var(--pb-stone)]/45 p-3 md:hidden">
            {visibleItems.map((item, index) => {
              const status = statusFor(item.daysToExpiry);
              return (
                <article key={item.id} className="border border-[#cfd7d0] bg-white p-4 shadow-[0_2px_8px_rgba(28,45,35,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.product}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--pb-cyan)]">Priority #{String(index + 1).padStart(2, "0")}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-[#edf0ec] py-3">
                    <div>
                      <dt className="text-xs text-[#748078]">Expiry</dt>
                      <dd className="mt-1 text-sm font-medium">{item.expiryDate}</dd>
                      <dd className="mt-0.5 text-xs text-[#69766e]">{expiryLabel(item.daysToExpiry)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#748078]">Quantity</dt>
                      <dd className="mt-1 text-xl font-semibold">{item.quantity}</dd>
                    </div>
                  </dl>
                  {item.daysToExpiry < 0 ? (
                    <button type="button" onClick={() => dumpExpired(item)} className="mt-3 h-11 w-full border border-[var(--pb-orange)] px-3 text-sm font-bold text-[#a74200] hover:bg-[var(--pb-peach)]">Mark dumped</button>
                  ) : item.isFefo ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => useStock(item, 1)} disabled={updatingItemId === item.id} className="h-11 border border-[var(--pb-cyan)] px-3 text-sm font-bold text-[#007c93] hover:bg-[#e2f7f9] disabled:cursor-not-allowed disabled:opacity-60">
                        {updatingItemId === item.id ? <span className="flex items-center justify-center gap-2"><FontAwesomeIcon icon={faCircleNotch} spin /> Updating</span> : "Use 1"}
                      </button>
                      <button type="button" onClick={() => openUseMultiple(item)} disabled={updatingItemId === item.id || item.quantity < 2} className="h-11 bg-[var(--pb-orange)] px-3 text-sm font-bold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60">Use multiple</button>
                    </div>
                  ) : (
                    <button type="button" disabled className="mt-3 h-11 w-full border border-[#d7dcd7] px-3 text-sm font-bold text-[#a3aca6]">FEFO locked</button>
                  )}
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                      <td className="px-4 py-4 font-semibold text-[var(--pb-cyan)]">#{String(index + 1).padStart(2, "0")}</td>
                      <td className="px-4 py-4 font-semibold">{item.product}</td>
                      <td className="px-4 py-4"><span className={`inline-block px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span><p className="mt-1.5 text-xs text-[#69766e]">{item.expiryDate} · {expiryLabel(item.daysToExpiry)}</p></td>
                      <td className="px-4 py-4 text-base font-semibold">{item.quantity}</td>
                      <td className="px-4 py-4">
                        {item.daysToExpiry < 0 ? (
                          <button type="button" onClick={() => dumpExpired(item)} className="h-9 border border-[var(--pb-orange)] px-3 text-xs font-bold text-[#a74200] hover:bg-[var(--pb-peach)]">Mark dumped</button>
                        ) : item.isFefo ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => useStock(item, 1)} disabled={updatingItemId === item.id} className="h-9 border border-[var(--pb-cyan)] px-3 text-xs font-bold text-[#007c93] hover:bg-[#e2f7f9] disabled:opacity-60">
                              {updatingItemId === item.id ? <FontAwesomeIcon icon={faCircleNotch} spin /> : "Use 1"}
                            </button>
                            <button type="button" onClick={() => openUseMultiple(item)} disabled={updatingItemId === item.id || item.quantity < 2} className="h-9 bg-[var(--pb-orange)] px-3 text-xs font-bold text-white hover:brightness-90 disabled:opacity-60">Use multiple</button>
                          </div>
                        ) : (
                          <button type="button" disabled title="Use stock with the earlier expiry date first" className="h-9 border border-[#d7dcd7] px-3 text-xs font-bold text-[#a3aca6]">FEFO locked</button>
                        )}
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

      {multipleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17251d]/55 p-4" role="presentation" onMouseDown={() => setMultipleItem(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="use-multiple-title" className="w-full max-w-sm border border-[#cbd4cc] bg-white shadow-[0_24px_80px_rgba(10,25,16,0.28)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#e1e5df] p-5">
              <div>
                <h2 id="use-multiple-title" className="text-xl font-semibold">Use multiple</h2>
                <p className="mt-1 text-sm text-[#68766d]">{multipleItem.product} · {multipleItem.quantity} available</p>
              </div>
              <button type="button" onClick={() => setMultipleItem(null)} aria-label="Close use multiple" className="h-9 w-9 text-xl text-[#526158] hover:bg-[#f1f4f1]">×</button>
            </div>
            <form onSubmit={useMultiple} autoComplete="off" noValidate className="p-5">
              <label htmlFor="use-quantity" className="text-xs font-semibold text-[#526158]">Quantity to use</label>
              <select
                id="use-quantity"
                autoFocus
                value={useQuantity}
                onChange={(event) => { setUseQuantity(event.target.value); setUseQuantityError(""); }}
                aria-invalid={Boolean(useQuantityError)}
                className={`mt-2 h-11 w-full border bg-white px-3 text-sm outline-none focus:ring-2 ${useQuantityError ? "border-[var(--pb-orange)] focus:ring-[var(--pb-orange)]/20" : "border-[var(--pb-stone)] focus:border-[var(--pb-cyan)] focus:ring-[var(--pb-cyan)]/20"}`}
              >
                <option value="" disabled>Select quantity</option>
                {Array.from({ length: multipleItem.quantity - 1 }, (_, index) => index + 2).map((quantity) => (
                  <option key={quantity} value={quantity}>{quantity}</option>
                ))}
              </select>
              {useQuantityError && <p className="mt-1.5 text-xs font-medium text-[#b3261e]">{useQuantityError}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setMultipleItem(null)} className="h-11 px-4 text-sm font-semibold text-[#526158] hover:bg-[#f1f4f1]">Cancel</button>
                <button type="submit" disabled={updatingItemId === multipleItem.id} className="h-11 bg-[var(--pb-orange)] px-5 text-sm font-semibold text-white hover:brightness-90 disabled:opacity-60">
                  {updatingItemId === multipleItem.id ? <span className="flex items-center gap-2"><FontAwesomeIcon icon={faCircleNotch} spin /> Updating</span> : "Use stock"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17251d]/55 p-4" role="presentation" onMouseDown={() => setIsAdding(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-stock-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto border border-[#cbd4cc] bg-white shadow-[0_24px_80px_rgba(10,25,16,0.28)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#e1e5df] p-5">
              <div>
                <h2 id="add-stock-title" className="text-xl font-semibold">Add / update stock</h2>
                <p className="mt-1 text-sm text-[#68766d]">The same product and expiry date are combined.</p>
              </div>
              <button type="button" onClick={() => setIsAdding(false)} aria-label="Close add or update stock" className="h-9 w-9 text-xl text-[#526158] hover:bg-[#f1f4f1]">×</button>
            </div>

            <form onSubmit={addItem} autoComplete="off" className="p-5">
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
                      className={`h-11 w-full border bg-white px-3 pr-10 text-sm text-[#1f292b] outline-none focus:ring-2 ${stockProductError ? "border-[var(--pb-orange)] focus:ring-[var(--pb-orange)]/20" : "border-[var(--pb-stone)] focus:border-[var(--pb-cyan)] focus:ring-[var(--pb-cyan)]/20"}`}
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
                          className={`block w-full px-3 py-2.5 text-left text-sm ${index === highlightedProductIndex ? "bg-[#d9f3f5] text-[#006b7f]" : "hover:bg-[var(--pb-stone)]/45"}`}
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
                    <input name="quantity" type="number" autoComplete="off" placeholder="12" min="1" required className="mt-2 h-11 w-full border border-[var(--pb-stone)] px-3 text-sm outline-none focus:border-[var(--pb-cyan)]" />
                  </label>
                  <label className="text-xs font-semibold text-[#526158]">
                    Expiry date
                    <input name="expiryDate" type="date" autoComplete="off" required className="mt-2 h-11 w-full border border-[var(--pb-stone)] px-3 text-sm outline-none focus:border-[var(--pb-cyan)]" />
                  </label>
                </div>
              </div>
              {products.length === 0 && <p className="mt-4 text-sm font-medium text-[#a63232]">Add a product before receiving stock.</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="h-11 px-4 text-sm font-semibold text-[#526158] hover:bg-[#f1f4f1]">Cancel</button>
                <button type="submit" disabled={products.length === 0} className="h-11 bg-[var(--pb-orange)] px-5 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50">Add / update stock</button>
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
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto border border-[#cbd4cc] bg-white shadow-[0_24px_80px_rgba(10,25,16,0.28)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#e1e5df] p-5">
              <div>
                <h2 id="products-title" className="text-xl font-semibold">Products</h2>
                <p className="mt-1 text-sm text-[#68766d]">Create the predefined names used for stock entry.</p>
              </div>
              <button type="button" onClick={() => setShowProducts(false)} aria-label="Close products" className="h-9 w-9 text-xl text-[#526158] hover:bg-[#f1f4f1]">×</button>
            </div>

            <form onSubmit={addProduct} autoComplete="off" noValidate className="border-b border-[#e1e5df] p-5">
              <div>
                <label htmlFor="product-name" className="text-xs font-semibold text-[#526158]">Product name</label>
                <input
                  id="product-name"
                  name="name"
                  placeholder="Product Name"
                  autoFocus
                  autoComplete="off"
                  value={productName}
                  aria-invalid={Boolean(productError)}
                  aria-describedby={productError ? "product-name-error" : undefined}
                  onChange={(event) => {
                    setProductName(event.target.value);
                    setProductError("");
                  }}
                  className={`mt-2 h-11 w-full border px-3 text-sm outline-none focus:ring-2 ${productError ? "border-[var(--pb-orange)] focus:border-[var(--pb-orange)] focus:ring-[var(--pb-orange)]/20" : "border-[var(--pb-stone)] focus:border-[var(--pb-cyan)] focus:ring-[var(--pb-cyan)]/20"}`}
                />
                {productError && <p id="product-name-error" className="mt-1.5 text-xs font-medium text-[#b3261e]">{productError}</p>}
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" className="h-11 bg-[var(--pb-orange)] px-5 text-sm font-semibold text-white hover:brightness-90">Add product</button>
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
                            autoComplete="off"
                            onChange={(event) => { setEditName(event.target.value); setEditError(""); }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") updateProduct(product);
                              if (event.key === "Escape") setEditingProduct(null);
                            }}
                            aria-label={`Edit ${product.name}`}
                            aria-invalid={Boolean(editError)}
                            className={`h-9 min-w-0 flex-1 border px-3 text-sm outline-none focus:ring-2 ${editError ? "border-[var(--pb-orange)] focus:ring-[var(--pb-orange)]/20" : "border-[var(--pb-cyan)] focus:ring-[var(--pb-cyan)]/20"}`}
                            autoFocus
                          />
                          <button type="button" onClick={() => updateProduct(product)} aria-label="Save product name" title="Save" className="flex h-9 w-9 items-center justify-center text-[#007c93] hover:bg-[#d9f3f5]">
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
                          className="flex h-9 w-9 items-center justify-center text-[#526158] hover:bg-[#d9f3f5] hover:text-[#007c93]"
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

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 right-4 z-[60] flex items-start gap-3 border px-4 py-3 text-sm font-medium shadow-[0_16px_45px_rgba(10,25,16,0.2)] sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-sm ${toast.type === "success" ? "border-[var(--pb-cyan)] bg-[#d9f3f5] text-[#006b7f]" : "border-[var(--pb-orange)] bg-[var(--pb-peach)] text-[#9c3f00]"}`}
        >
          <FontAwesomeIcon icon={toast.type === "success" ? faCheck : faXmark} className="mt-0.5" />
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="ml-2 opacity-70 hover:opacity-100"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
      )}
    </main>
  );
}