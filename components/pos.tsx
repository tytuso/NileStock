"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { CartItem, PaymentMethod, Sale } from "@/lib/types";
import { money, totals } from "@/lib/utils";
import { findProductByCode } from "@/lib/product-codes";
import {
  describeCameraIssue,
  isAppleMobileDevice,
  requestCameraAccess,
} from "@/lib/camera-permission";
import type { CameraIssue } from "@/lib/camera-permission";
import { Button, Card, Field, Input, Modal, Select } from "./ui";
import { Receipt } from "./receipt";

const CAMERA_KEY = "nilestock.preferred-camera";
let scanAudioContext: AudioContext | null = null;

function prepareScanFeedback() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    scanAudioContext ||= new AudioContextClass();
    if (scanAudioContext.state === "suspended") void scanAudioContext.resume();
  } catch {}
}

function playScanSuccess() {
  navigator.vibrate?.([45, 30, 45]);
  try {
    prepareScanFeedback();
    if (!scanAudioContext) return;
    const start = scanAudioContext.currentTime;
    [880, 1174].forEach((frequency, index) => {
      const oscillator = scanAudioContext!.createOscillator();
      const gain = scanAudioContext!.createGain();
      const toneStart = start + index * 0.085;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(0.16, toneStart + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.075);
      oscillator.connect(gain).connect(scanAudioContext!.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneStart + 0.08);
    });
  } catch {}
}

export function POS() {
  const { data, setData, completeSale } = useApp();
  const [cart, setCart] = useState<CartItem[]>([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [discount, setDiscount] = useState(0),
    [customer, setCustomer] = useState(""),
    [payOpen, setPayOpen] = useState(false),
    [payment, setPayment] = useState<PaymentMethod>("Cash"),
    [paid, setPaid] = useState(0),
    [receipt, setReceipt] = useState<Sale | null>(null),
    [scanOpen, setScanOpen] = useState(false),
    [offline, setOffline] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const f = () => setOffline(!navigator.onLine);
    f();
    addEventListener("online", f);
    addEventListener("offline", f);
    return () => {
      removeEventListener("online", f);
      removeEventListener("offline", f);
    };
  }, []);
  const add = useCallback(
    (id: string) => {
      const p = data.products.find((product) => product.id === id);
      if (!p || p.stock < 1) return;
      setCart((current) =>
        current.some((item) => item.productId === id)
          ? current.map((item) =>
              item.productId === id
                ? { ...item, qty: Math.min(p.stock, item.qty + 1) }
                : item,
            )
          : [
              ...current,
              {
                productId: p.id,
                name: p.name,
                price: p.price,
                cost: p.cost,
                qty: 1,
                discount: 0,
              },
            ],
      );
      setQuery("");
    },
    [data.products],
  );
  const scan = useCallback(
    (code: string) => {
      const product = findProductByCode(data.products, code);
      if (!product || product.stock < 1) return false;
      add(product.id);
      playScanSuccess();
      return true;
    },
    [add, data.products],
  );
  const openScanner = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    prepareScanFeedback();
    setScanOpen(true);
  }, []);
  const acceptCameraCode = useCallback(
    (code: string) => {
      if (!scan(code)) return false;
      setScanOpen(false);
      return true;
    },
    [scan],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        cart.length && setPayOpen(true);
      }
      if (e.key === "Escape") setPayOpen(false);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [cart.length]);
  const calc = useMemo(
    () =>
      totals(
        cart,
        discount,
        data.business.taxEnabled ? data.business.taxRate : 0,
      ),
    [cart, discount, data.business],
  );
  const products = data.products.filter(
    (p) =>
      p.active &&
      (category === "All" || p.category === category) &&
      (!query ||
        `${p.name} ${p.sku} ${p.barcode}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const finish = () => {
    if (payment === "Customer Credit" && !customer) return;
    const c = data.customers.find((x) => x.id === customer);
    const sale = completeSale({
      ...calc,
      items: cart,
      customerId: customer || undefined,
      customerName: c?.name,
      payment,
      paid: payment === "Cash" ? paid : calc.total,
      change: payment === "Cash" ? Math.max(0, paid - calc.total) : 0,
      note: "",
    });
    setPayOpen(false);
    setReceipt(sale);
  };
  if (receipt)
    return (
      <Receipt
        sale={receipt}
        onNew={() => {
          setReceipt(null);
          setCart([]);
          setPaid(0);
          setDiscount(0);
          setCustomer("");
        }}
      />
    );
  return (
    <div className="-m-4 grid h-[calc(100vh-72px)] grid-cols-1 overflow-hidden lg:-m-7 lg:grid-cols-[1fr_390px] lg:h-[calc(100vh-64px)]">
      <section className="flex min-h-0 flex-col border-line lg:border-r">
        <div className="border-b border-line p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-muted" size={18} />
              <Input
                ref={input}
                className="pl-10"
                placeholder="Search or scan a product…  F2"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.endsWith("\n"))
                    scan(e.target.value.trim());
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query) {
                    if (!scan(query.trim()) && products.length === 1)
                      add(products[0].id);
                  }
                }}
              />
            </div>
            <Button onClick={openScanner}>
              <Camera size={18} />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
          <div className="scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {["All", ...new Set(data.products.map((p) => p.category))].map(
              (c) => (
                <Button
                  key={c}
                  variant={category === c ? "primary" : "ghost"}
                  className="shrink-0"
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Button>
              ),
            )}
          </div>
        </div>
        {offline && (
          <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
            <WifiOff size={14} /> Offline — sales are safely queued and will
            sync when connected.
          </div>
        )}
        <div className="scrollbar grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              className="focusable min-h-28 rounded-xl border border-line bg-surface p-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft disabled:opacity-45"
              disabled={p.stock < 1}
              onClick={() => add(p.id)}
            >
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 font-bold text-emerald-700">
                {p.name[0]}
              </div>
              <b className="line-clamp-2 text-sm">{p.name}</b>
              <div className="mt-1 flex justify-between text-xs">
                <span className="font-semibold text-accent">
                  {money(p.price, data.business.currency)}
                </span>
                <span className="text-muted">{p.stock} left</span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <aside className="flex min-h-[55vh] flex-col bg-surface lg:min-h-0">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShoppingCart size={18} /> Current sale{" "}
            <span className="text-muted">
              ({cart.reduce((s, i) => s + i.qty, 0)})
            </span>
          </h2>
          {cart.length > 0 && (
            <Button variant="ghost" onClick={() => setCart([])}>
              Clear
            </Button>
          )}
        </div>
        <div className="scrollbar flex-1 overflow-auto p-3">
          {!cart.length ? (
            <div className="grid h-full place-items-center text-center text-muted">
              <div>
                <ShoppingCart className="mx-auto mb-2" />
                <p className="font-medium">Ready for the next customer</p>
                <p className="text-xs">Scan a product or tap it to begin.</p>
              </div>
            </div>
          ) : (
            cart.map((i) => (
              <Card
                className="mb-2 flex items-center gap-2 p-3"
                key={i.productId}
              >
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{i.name}</b>
                  <span className="text-xs text-muted">
                    {money(i.price, data.business.currency)} each
                  </span>
                </div>
                <div className="flex items-center rounded-lg border border-line">
                  <button
                    className="p-2"
                    onClick={() =>
                      setCart((c) =>
                        c.map((x) =>
                          x.productId === i.productId
                            ? { ...x, qty: Math.max(1, x.qty - 1) }
                            : x,
                        ),
                      )
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <b className="w-6 text-center text-sm">{i.qty}</b>
                  <button className="p-2" onClick={() => add(i.productId)}>
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={() =>
                    setCart((c) => c.filter((x) => x.productId !== i.productId))
                  }
                  className="p-2 text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </Card>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="border-t border-line p-4">
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-muted">Subtotal</span>
              <b className="text-right">
                {money(calc.subtotal, data.business.currency)}
              </b>
              <span className="text-muted">Discount</span>
              <b className="text-right">
                -{money(calc.discount, data.business.currency)}
              </b>
              <span className="text-muted">Tax</span>
              <b className="text-right">
                {money(calc.tax, data.business.currency)}
              </b>
              <span className="mt-2 text-base font-bold">Total</span>
              <b className="tabular mt-2 text-right text-2xl text-accent">
                {money(calc.total, data.business.currency)}
              </b>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                className="px-3"
                title="Clear current sale"
                aria-label="Clear current sale"
                onClick={() => setCart([])}
              >
                <Trash2 size={17} />
              </Button>
              <Button
                variant="secondary"
                className="h-12 w-12 shrink-0 px-0"
                title="Scan next product"
                aria-label="Open camera to scan next product"
                onClick={openScanner}
              >
                <Camera size={19} />
              </Button>
              <Button
                className="h-12 flex-1 text-base"
                onClick={() => {
                  setPaid(0);
                  setPayOpen(true);
                }}
              >
                Pay <span className="hidden opacity-60 sm:inline">F4</span>
              </Button>
            </div>
            {data.held.length > 0 && (
              <button
                className="mt-2 w-full text-xs text-accent"
                onClick={() => {
                  setCart(data.held[0].items);
                  setData((d) => ({ ...d, held: d.held.slice(1) }));
                }}
              >
                Resume {data.held.length} held sale
                {data.held.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </aside>
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Complete payment"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 p-4 text-center text-emerald-950">
            <span className="text-xs font-bold uppercase tracking-widest">
              Amount due
            </span>
            <div className="tabular text-3xl font-bold">
              {money(calc.total, data.business.currency)}
            </div>
          </div>
          <Field label="Payment method">
            <Select
              value={payment}
              onChange={(e) => setPayment(e.target.value as PaymentMethod)}
            >
              {[
                "Cash",
                "Mobile Money",
                "Card",
                "Bank",
                "Customer Credit",
                "Other",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          {payment === "Cash" && (
            <>
              <Field label="Cash received">
                <Input
                  autoFocus
                  type="number"
                  min={calc.total}
                  placeholder="0000"
                  value={paid || ""}
                  onChange={(e) => setPaid(+e.target.value)}
                />
              </Field>
              <div className="flex justify-between rounded-lg border border-line p-3">
                <span>Change</span>
                <b className="text-lg text-accent">
                  {money(
                    Math.max(0, paid - calc.total),
                    data.business.currency,
                  )}
                </b>
              </div>
            </>
          )}
          <Field
            label={
              payment === "Customer Credit"
                ? "Customer (required)"
                : "Customer (optional)"
            }
          >
            <Select
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Walk-in customer</option>
              {data.customers.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            className="h-12 w-full"
            disabled={
              (payment === "Cash" && paid < calc.total) ||
              (payment === "Customer Credit" && !customer)
            }
            onClick={finish}
          >
            Complete sale
          </Button>
        </div>
      </Modal>
      <Scanner
        open={scanOpen}
        close={() => setScanOpen(false)}
        onCode={acceptCameraCode}
      />
    </div>
  );
}
function Scanner({
  open,
  close,
  onCode,
}: {
  open: boolean;
  close: () => void;
  onCode: (c: string) => boolean;
}) {
  const [id] = useState(() => `scanner-${Math.random().toString(36).slice(2)}`),
    [manual, setManual] = useState(""),
    [error, setError] = useState(""),
    [cameraState, setCameraState] = useState<
      "starting" | "active" | "blocked" | "unavailable"
    >("starting"),
    [cameraIssue, setCameraIssue] = useState<CameraIssue | null>(null),
    [requestingCamera, setRequestingCamera] = useState(false),
    [retryVersion, setRetryVersion] = useState(0);
  const showCameraIssue = useCallback((cause: unknown) => {
    const issue = describeCameraIssue(cause, {
      isAppleMobile: isAppleMobileDevice(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      ),
      isSecureContext: window.isSecureContext,
    });
    setCameraIssue(issue);
    setCameraState(issue.kind === "denied" ? "blocked" : "unavailable");
  }, []);
  const retryCamera = useCallback(async () => {
    setRequestingCamera(true);
    setCameraState("starting");
    setCameraIssue(null);
    setError("");
    try {
      await requestCameraAccess(navigator.mediaDevices);
      localStorage.removeItem(CAMERA_KEY);
      setRetryVersion((version) => version + 1);
    } catch (cause) {
      showCameraIssue(cause);
    } finally {
      setRequestingCamera(false);
    }
  }, [showCameraIssue]);
  const submit = (raw: string) => {
    const code = raw.trim();
    if (!code) {
      setError("Enter the barcode, QR code or SKU, then try again.");
      return false;
    }
    if (onCode(code)) {
      setError("");
      setManual("");
      return true;
    }
    setError(
      `No product matches “${code}”. Check the digits and re-enter the code.`,
    );
    return false;
  };
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    setManual("");
    setError("");
    setCameraState("starting");
    setCameraIssue(null);
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let stopped = false;
    let accepted = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const remembered = localStorage.getItem(CAMERA_KEY);
        const cameras = remembered ? [] : await Html5Qrcode.getCameras();
        const selected = cameras.length
          ? cameras.find((camera) =>
              /back|rear|environment/i.test(camera.label),
            ) || cameras.at(-1)
          : undefined;
        if (selected) localStorage.setItem(CAMERA_KEY, selected.id);
        scanner = new Html5Qrcode(id);
        await scanner.start(
          remembered || selected?.id || { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 160 } },
          (code: string) => {
            if (accepted || stopped) return;
            if (onCode(code)) {
              accepted = true;
            } else {
              setError(
                `No product matches “${code}”. Check the barcode and scan again.`,
              );
            }
          },
          () => {},
        );
        if (stopped) await scanner.stop().catch(() => {});
        else setCameraState("active");
      } catch (cause) {
        if (stopped) return;
        showCameraIssue(cause);
      }
    })();
    return () => {
      stopped = true;
      scanner?.stop().catch(() => {});
    };
  }, [open, id, onCode, retryVersion, showCameraIssue]);
  return (
    <Modal open={open} onClose={close} title="Scan product">
      <div className="scanner-lock relative overflow-hidden rounded-xl bg-black">
        <div id={id} className="min-h-64" />
        {cameraState !== "active" && (
          <div
            className="pointer-events-none absolute inset-0 grid min-h-64 place-items-center bg-gradient-to-b from-black/70 to-black/90 p-6 text-center text-white"
            aria-live="polite"
          >
            <div>
              {cameraState === "starting" ? (
                <LoaderCircle className="mx-auto mb-3 animate-spin" size={28} />
              ) : (
                <CameraOff className="mx-auto mb-3" size={28} />
              )}
              <p className="text-sm font-semibold">
                {cameraState === "starting"
                  ? requestingCamera
                    ? "Requesting camera permission…"
                    : "Starting rear camera…"
                  : "Camera needs attention"}
              </p>
            </div>
          </div>
        )}
        {cameraState === "active" && (
          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-2.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <CheckCircle2 size={14} /> Camera ready
          </span>
        )}
      </div>
      {cameraIssue && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
        >
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 shrink-0" size={18} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{cameraIssue.title}</p>
              <p className="mt-1 text-xs leading-5 opacity-85">
                {cameraIssue.message}
              </p>
              {cameraIssue.settingsHint && (
                <p className="mt-1.5 text-xs leading-5 opacity-85">
                  {cameraIssue.settingsHint}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                className="mt-3 min-h-9 bg-surface px-3 text-xs text-ink"
                disabled={requestingCamera}
                onClick={retryCamera}
              >
                {requestingCamera ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : cameraIssue.kind === "denied" ? (
                  <Camera size={15} />
                ) : (
                  <RotateCcw size={15} />
                )}
                {requestingCamera
                  ? "Requesting…"
                  : cameraIssue.kind === "denied"
                    ? "Allow camera"
                    : "Try camera again"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p
          id="scanner-code-error"
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
        >
          <CircleAlert className="mt-0.5 shrink-0" size={17} />
          <span>{error}</span>
        </p>
      )}
      <p className="mt-3 text-sm text-muted">
        Camera scanning is active. Tap the field only when you want to enter a
        code manually.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          aria-invalid={!!error}
          aria-describedby={error ? "scanner-code-error" : "scanner-manual-help"}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Tap to enter barcode, QR or SKU"
          value={manual}
          onChange={(e) => {
            setManual(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(manual);
            }
          }}
        />
        <Button onClick={() => submit(manual)}>Add</Button>
      </div>
      <p id="scanner-manual-help" className="mt-2 text-xs text-muted">
        Camera video stays on this device and is used only to read product
        codes. NileStock remembers the camera you approved on this phone. If
        the code is not recognised, add it to the product first.
      </p>
    </Modal>
  );
}
