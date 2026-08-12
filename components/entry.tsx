"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Download,
  Facebook,
  MailCheck,
  Menu,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { Button, Card, Field, Input, Modal } from "./ui";
import { NileStockApp } from "./nilestock-app";
import { useApp } from "@/lib/store";
import { demoData } from "@/lib/utils";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import type { AppData } from "@/lib/types";
import { isRepeatedSignup } from "@/lib/auth-account";
import { resolveNileStockAuthRedirect } from "@/lib/auth-redirect";
import {
  isAppData,
  parseLegacyWorkspace,
  parseWorkspaceBackup,
  saveWorkspaceBackup,
  selectNewestWorkspace,
  workspaceBackupKey,
} from "@/lib/workspace-backup";
import type { User } from "@supabase/supabase-js";
import {
  buildCloudSaleRows,
  markSalesSynced,
  mergeCloudSales,
  parseCloudSale,
  salesSyncFingerprint,
} from "@/lib/sale-sync";
type Session = {
  email: string;
  name: string;
  founder: boolean;
  cloud?: boolean;
  userId?: string;
  businessId?: string;
};
function authRedirectUrl() {
  return resolveNileStockAuthRedirect({
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    deploymentUrl: process.env.NEXT_PUBLIC_VERCEL_URL,
    currentOrigin:
      typeof location !== "undefined" ? location.origin : undefined,
  });
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed"))
    return "Confirm your email first. Open the NileStock email in your inbox, then sign in.";
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  )
    return "That email or password is not correct. If you joined with Google, continue with Google.";
  if (
    normalized.includes("already registered") ||
    normalized.includes("duplicate key")
  )
    return "An account already exists for this email. Sign in instead, or continue with Google if that is how you joined.";
  if (normalized.includes("rate limit"))
    return "Too many emails were requested. Wait a few minutes, then resend the confirmation once.";
  return message;
}
async function withAuthTimeout<T>(operation: PromiseLike<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "Sign-in is taking too long. Check your connection and try again.",
              ),
            ),
          15_000,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
export function Entry() {
  const { data, setData, setRole } = useApp();
  const [session, setSession] = useState<Session | null | undefined>(undefined),
    [auth, setAuth] = useState<"login" | "signup" | null>(null),
    [googleProfile, setGoogleProfile] = useState(false),
    [authMessage, setAuthMessage] = useState(""),
    [authEmail, setAuthEmail] = useState(""),
    [confirmationEmail, setConfirmationEmail] = useState(""),
    [resendBusy, setResendBusy] = useState(false),
    [authBusy, setAuthBusy] = useState(false),
    [cloudReady, setCloudReady] = useState(false),
    [syncPulse, setSyncPulse] = useState(0),
    [installHelp, setInstallHelp] = useState(false),
    [install, setInstall] = useState<any>(null),
    [menu, setMenu] = useState(false),
    [pricingAnnual, setPricingAnnual] = useState(false);
  const menuPanel = useRef<HTMLElement>(null),
    menuButton = useRef<HTMLButtonElement>(null),
    authRequestActive = useRef(false),
    hydratedUser = useRef<string | null>(null),
    hydratingUser = useRef<string | null>(null),
    lastUploadedSales = useRef("");
  useLayoutEffect(() => {
    if (session === null) document.documentElement.classList.remove("dark");
  }, [session]);
  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    addEventListener("beforeinstallprompt", capture);
    return () => removeEventListener("beforeinstallprompt", capture);
  }, []);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const raw = localStorage.getItem("nilestock.session");
      setSession(raw ? (JSON.parse(raw) as Session) : null);
      setCloudReady(false);
      return;
    }
    let active = true;
    const hydrate = async (user: User | null) => {
      if (!active) return;
      if (!user) {
        hydratedUser.current = null;
        hydratingUser.current = null;
        setCloudReady(false);
        setSession(null);
        return;
      }
      if (
        hydratedUser.current === user.id ||
        hydratingUser.current === user.id
      )
        return;
      hydratingUser.current = user.id;
      const email = user.email || "";
      const name = String(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          email ||
          "Signed-in user",
      );
      const requestedBusiness = String(
        user.user_metadata?.business_name || `${name}'s Shop`,
      );
      try {
        const { data: businessId, error: ensureError } = await supabase.rpc(
          "ensure_nilestock_business",
          { p_name: requestedBusiness },
        );
        if (!active) return;
        if (ensureError || !businessId) {
          setAuthMessage(
            ensureError?.message || "Could not create the NileStock workspace.",
          );
          await supabase.auth.signOut();
          return;
        }
        const [businessResult, memberResult, workspaceResult, salesResult] =
          await Promise.all([
            supabase
              .from("nilestock_businesses")
              .select("name,plan,status")
              .eq("id", businessId)
              .single(),
            supabase
              .from("nilestock_business_members")
              .select("role,status")
              .eq("business_id", businessId)
              .eq("user_id", user.id)
              .single(),
            supabase
              .from("nilestock_workspace_data")
              .select("payload,updated_at")
              .eq("business_id", businessId)
              .maybeSingle(),
            supabase
              .from("nilestock_sales")
              .select("payload")
              .eq("business_id", businessId)
              .order("created_at", { ascending: false }),
          ]);
        if (!active) return;
        if (businessResult.error || memberResult.error) {
          setAuthMessage(
            businessResult.error?.message ||
              memberResult.error?.message ||
              "Could not load your business access.",
          );
          return;
        }
        if (businessResult.data.status === "revoked") {
          setAuthMessage("Access to this NileStock business has been revoked.");
          await supabase.auth.signOut();
          return;
        }

        let localBackup = parseWorkspaceBackup(
          localStorage.getItem(workspaceBackupKey(String(businessId))),
        );
        const cloudWorkspace = isAppData(workspaceResult.data?.payload)
          ? workspaceResult.data.payload
          : null;
        const legacyWorkspace = parseLegacyWorkspace(
          localStorage.getItem("nilestock.v3.clean"),
          email,
          businessResult.data.name,
        );
        if (
          !localBackup &&
          legacyWorkspace &&
          (!cloudWorkspace ||
            (!cloudWorkspace.products.length && legacyWorkspace.products.length > 0))
        )
          localBackup = {
            savedAt: new Date().toISOString(),
            payload: legacyWorkspace,
          };
        if (workspaceResult.error && !localBackup) {
          setAuthMessage(
            "Your workspace could not be downloaded. Nothing was replaced—check the connection and try again.",
          );
          setSession(null);
          return;
        }
        const selected = selectNewestWorkspace({
          cloudPayload: workspaceResult.data?.payload,
          cloudUpdatedAt: workspaceResult.data?.updated_at,
          localBackup,
        });
        let workspace: AppData;
        if (selected.payload) workspace = selected.payload;
        else {
          workspace = demoData();
          workspace.staff = [
            {
              id: user.id,
              name,
              email,
              role: memberResult.data.role as "owner" | "manager" | "cashier",
              status: "active",
            },
          ];
          workspace.audit = [
            {
              id: crypto.randomUUID(),
              actor: name,
              action: "Cloud business workspace created",
              record: businessResult.data.name,
              createdAt: new Date().toISOString(),
            },
          ];
        }
        workspace = {
          ...workspace,
          business: {
            ...workspace.business,
            name: businessResult.data.name,
            email: workspace.business.email || email,
            plan: businessResult.data.plan as AppData["business"]["plan"],
          },
        };
        if (salesResult.error)
          console.error(
            "NileStock could not download cross-device sales. Apply the v10.2.4 Supabase migration, then retry.",
            salesResult.error,
          );
        else {
          const cloudSalePayloads = (salesResult.data || []).map(
            (row) => row.payload,
          );
          workspace = mergeCloudSales(workspace, cloudSalePayloads);
          const confirmedSaleIds = new Set(
            cloudSalePayloads.flatMap((payload) => {
              const sale = parseCloudSale(payload);
              return sale ? [sale.id] : [];
            }),
          );
          workspace = {
            ...workspace,
            sales: workspace.sales.map((sale) =>
              sale.synced && !confirmedSaleIds.has(sale.id)
                ? { ...sale, synced: false }
                : sale,
            ),
          };
        }
        lastUploadedSales.current = "";
        setData(workspace);
        setRole(memberResult.data.role as "owner" | "manager" | "cashier");
        setSession({
          email,
          name,
          founder:
            email.toLowerCase() ===
            (
              process.env.NEXT_PUBLIC_FOUNDER_EMAIL ||
              "opiotitus333@gmail.com"
            ).toLowerCase(),
          cloud: true,
          userId: user.id,
          businessId: String(businessId),
        });
        localStorage.setItem("nilestock.cloud.businessId", String(businessId));
        hydratedUser.current = user.id;
        setCloudReady(true);
        setAuth(null);
        setAuthMessage("");
      } catch (error) {
        if (active)
          setAuthMessage(
            error instanceof Error
              ? error.message
              : "Could not load your NileStock workspace.",
          );
      } finally {
        if (hydratingUser.current === user.id) hydratingUser.current = null;
      }
    };
    void supabase.auth
      .getSession()
      .then(({ data: result }) => hydrate(result.session?.user || null))
      .catch(() => {
        if (active) setSession(null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") void hydrate(null);
      else if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      )
        void hydrate(nextSession?.user || null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setData, setRole]);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (
      !supabase ||
      !cloudReady ||
      !session?.cloud ||
      !session.businessId ||
      !session.userId
    )
      return;
    saveWorkspaceBackup(session.businessId, data);
    const timeout = setTimeout(() => {
      const updatedAt = new Date().toISOString();
      void Promise.all([
        supabase.from("nilestock_workspace_data").upsert({
          business_id: session.businessId,
          payload: data,
          updated_by: session.userId,
          updated_at: updatedAt,
        }),
        supabase
          .from("nilestock_businesses")
          .update({ name: data.business.name, updated_at: updatedAt })
          .eq("id", session.businessId),
      ]).then(([workspaceResult, businessResult]) => {
        if (workspaceResult.error || businessResult.error)
          console.error(
            "NileStock cloud sync failed; the local workspace backup remains safe.",
            workspaceResult.error || businessResult.error,
          );
      });
    }, 700);
    return () => clearTimeout(timeout);
  }, [cloudReady, data, session]);
  const pullCloudSales = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (
      !supabase ||
      !cloudReady ||
      !session?.cloud ||
      !session.businessId
    )
      return;
    const result = await supabase
      .from("nilestock_sales")
      .select("payload")
      .eq("business_id", session.businessId)
      .order("created_at", { ascending: false });
    if (result.error) {
      console.error(
        "NileStock could not refresh cross-device sales. The local copy remains safe.",
        result.error,
      );
      return;
    }
    setData((current) =>
      mergeCloudSales(
        current,
        (result.data || []).map((row) => row.payload),
      ),
    );
  }, [cloudReady, session?.businessId, session?.cloud, setData]);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (
      !supabase ||
      !cloudReady ||
      !session?.cloud ||
      !session.businessId ||
      !session.userId
    )
      return;

    const fingerprint = salesSyncFingerprint(data.sales);
    const syncKey = `${session.businessId}:${fingerprint}`;
    if (lastUploadedSales.current === syncKey) return;
    if (!data.sales.length) {
      lastUploadedSales.current = syncKey;
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      void (async () => {
        const rows = buildCloudSaleRows(
          data.sales,
          session.businessId!,
          session.userId!,
        );
        for (let index = 0; index < rows.length; index += 100) {
          const result = await supabase
            .from("nilestock_sales")
            .upsert(rows.slice(index, index + 100), {
              onConflict: "business_id,id",
            });
          if (result.error) {
            console.error(
              "NileStock sale sync failed; receipts remain queued safely on this device.",
              result.error,
            );
            return;
          }
        }
        if (cancelled) return;
        lastUploadedSales.current = syncKey;
        const confirmedIds = new Set(rows.map((row) => row.id));
        setData((current) => markSalesSynced(current, confirmedIds));
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [cloudReady, data.sales, session, setData, syncPulse]);
  useEffect(() => {
    if (!cloudReady || !session?.cloud) return;
    const refresh = () => {
      setSyncPulse((current) => current + 1);
      void pullCloudSales();
    };
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    addEventListener("online", refresh);
    addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      removeEventListener("online", refresh);
      removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [cloudReady, pullCloudSales, session?.cloud]);
  useEffect(() => {
    if (!menu) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !menuPanel.current?.contains(target) &&
        !menuButton.current?.contains(target)
      )
        setMenu(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menu]);
  const login = (email: string, name = "Shop Owner", business?: string) => {
    const accountKey = `nilestock.account.${email.toLowerCase()}`;
    const saved = localStorage.getItem(accountKey);
    const savedAccount = saved
      ? (JSON.parse(saved) as { name?: string; business?: string })
      : null;
    const resolvedName =
      name && !["Google User", "Shop Owner"].includes(name)
        ? name.trim()
        : savedAccount?.name || name;
    const s = {
      email,
      name: resolvedName,
      founder:
        email.toLowerCase() ===
        (
          process.env.NEXT_PUBLIC_FOUNDER_EMAIL || "opiotitus333@gmail.com"
        ).toLowerCase(),
    };
    localStorage.setItem("nilestock.session", JSON.stringify(s));
    localStorage.setItem(
      accountKey,
      JSON.stringify({
        name: resolvedName,
        business: business || savedAccount?.business,
        email,
      }),
    );
    if (business)
      setData((d) => ({
        ...d,
        business: { ...d.business, name: business, email, plan: "free" },
        staff: [
          {
            id: crypto.randomUUID(),
            name: resolvedName,
            email,
            role: "owner",
            status: "active",
          },
        ],
        audit: [
          {
            id: crypto.randomUUID(),
            actor: resolvedName,
            action: "Business account created",
            record: business,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    setSession(s);
    setAuth(null);
  };
  const authenticate = async (formData: FormData) => {
    if (authRequestActive.current) return;
    authRequestActive.current = true;
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "Shop Owner").trim();
    const business = String(formData.get("business") || "").trim();
    const supabase = getSupabaseBrowserClient();
    setAuthMessage("");
    setAuthBusy(true);
    try {
      if (!supabase) {
        login(email, name, auth === "signup" ? business : undefined);
        return;
      }
      if (auth === "signup") {
        const { data: result, error } = await withAuthTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: authRedirectUrl(),
              data: {
                full_name: name,
                business_name: business,
                app_name: "nilestock",
              },
            },
          }),
        );
        if (error) throw error;
        if (isRepeatedSignup(result)) {
          setAuth("login");
          setConfirmationEmail("");
          setAuthMessage(
            "An account already exists for this email. Sign in with your password, or continue with Google if that is how you joined.",
          );
          return;
        }
        if (!result.session) {
          setConfirmationEmail(email);
          setAuthMessage("");
        }
      } else {
        const { error } = await withAuthTimeout(
          supabase.auth.signInWithPassword({ email, password }),
        );
        if (error) throw error;
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? friendlyAuthError(error.message)
          : "Authentication failed.",
      );
    } finally {
      authRequestActive.current = false;
      setAuthBusy(false);
    }
  };
  const resendConfirmation = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !confirmationEmail || resendBusy) return;
    setResendBusy(true);
    setAuthMessage("");
    try {
      const { error } = await withAuthTimeout(
        supabase.auth.resend({
          type: "signup",
          email: confirmationEmail,
          options: { emailRedirectTo: authRedirectUrl() },
        }),
      );
      if (error) throw error;
      setAuthMessage("A fresh confirmation email has been sent.");
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? friendlyAuthError(error.message)
          : "The confirmation email could not be resent.",
      );
    } finally {
      setResendBusy(false);
    }
  };
  const signInWithGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    setAuthMessage("");
    if (!supabase) {
      setAuth(null);
      setGoogleProfile(true);
      return;
    }
    setAuthBusy(true);
    const { error } = await withAuthTimeout(
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirectUrl() },
      }),
    ).catch((caught) => ({
      error: caught instanceof Error ? caught : new Error("Google sign-in failed."),
    }));
    if (error) {
      setAuthMessage(error.message);
      setAuthBusy(false);
    }
  };
  const signOut = async () => {
    if (session?.cloud && session.businessId && session.userId) {
      saveWorkspaceBackup(session.businessId, data);
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const updatedAt = new Date().toISOString();
        const saves: PromiseLike<unknown>[] = [
          supabase.from("nilestock_workspace_data").upsert({
            business_id: session.businessId,
            payload: data,
            updated_by: session.userId,
            updated_at: updatedAt,
          }),
          supabase
            .from("nilestock_businesses")
            .update({ name: data.business.name, updated_at: updatedAt })
            .eq("id", session.businessId),
        ];
        if (data.sales.length)
          saves.push(
            supabase.from("nilestock_sales").upsert(
              buildCloudSaleRows(
                data.sales,
                session.businessId,
                session.userId,
                updatedAt,
              ),
              { onConflict: "business_id,id" },
            ),
          );
        await Promise.all(saves).catch(() => undefined);
        await supabase.auth.signOut();
      }
    }
    localStorage.removeItem("nilestock.session");
    localStorage.removeItem("nilestock.cloud.businessId");
    setCloudReady(false);
    setSession(null);
  };
  const promptInstall = async () => {
    setMenu(false);
    if (install) {
      await install.prompt();
      setInstall(null);
      return;
    }
    setInstallHelp(true);
  };
  if (session === undefined) return null;
  if (session)
    return (
      <NileStockApp session={session} signOut={signOut} />
    );
  return (
    <div className="min-h-screen overflow-hidden bg-[#f8faf9] text-[#13231c]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(124,200,255,.32),transparent_36%),radial-gradient(circle_at_16%_75%,rgba(75,211,154,.16),transparent_30%),radial-gradient(circle_at_90%_60%,rgba(124,145,255,.12),transparent_28%)]" />
      <header className="relative z-20 mx-auto flex h-20 max-w-7xl items-center px-5">
        <a className="flex items-center gap-3" href="#">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#087c55] text-lg font-bold text-white">
            N
          </span>
          <span>
            <b className="block">NileStock</b>
            <small className="block text-[10px] font-bold uppercase tracking-[.18em] text-[#62736b]">
              Retail operating system
            </small>
          </span>
        </a>
        <nav
          ref={menuPanel}
          className={`${menu ? "flex" : "hidden"} absolute left-5 right-5 top-20 flex-col gap-2 rounded-2xl border bg-white p-4 shadow-xl md:static md:ml-auto md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
        >
          <Button
            variant="ghost"
            onClick={() => {
              setMenu(false);
              setAuth("login");
            }}
          >
            Sign in
          </Button>
          <Button
            onClick={() => {
              setMenu(false);
              setAuth("signup");
            }}
          >
            Create account
          </Button>
          <Button variant="secondary" onClick={promptInstall}>
            <Download size={16} /> Install app
          </Button>
        </nav>
        <button
          ref={menuButton}
          className="ml-auto md:hidden"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main className="relative">
        <section className="mx-auto grid min-h-[680px] max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Built for
              African retail
            </span>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.045em] md:text-7xl">
              Run every sale.
              <br />
              <span className="bg-gradient-to-r from-[#087c55] via-[#1676a3] to-[#5c6ac4] bg-clip-text text-transparent">
                Control every product.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#56675f]">
              NileStock turns your phone or laptop into a complete retail
              operating system—fast POS, live stock, receipts, customer credit
              and business reports in one premium workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button className="h-12 px-6" onClick={() => setAuth("signup")}>
                Start free <ArrowRight size={17} />
              </Button>
              <Button
                variant="secondary"
                className="h-12 px-6"
                onClick={() => login("demo@nilestock.app", "Demo Owner")}
              >
                Preview workspace
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-xs font-semibold text-[#62736b]">
              <span className="flex gap-2">
                <Check size={15} className="text-emerald-600" /> No card
                required
              </span>
              <span className="flex gap-2">
                <Check size={15} className="text-emerald-600" /> Works offline
              </span>
              <span className="flex gap-2">
                <Check size={15} className="text-emerald-600" /> Installable PWA
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-sky-200/35 blur-3xl" />
            <Card className="relative overflow-hidden border-white/80 bg-white/80 p-3 shadow-[0_30px_80px_rgba(25,68,53,.16)] backdrop-blur-xl">
              <div className="rounded-xl bg-[#12251e] p-5 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-200">
                    Today’s sales
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px]">
                    Live
                  </span>
                </div>
                <b className="mt-2 block text-4xl">UGX 1,248,000</b>
                <div className="mt-7 grid grid-cols-3 gap-2">
                  {[
                    ["Transactions", "84"],
                    ["Profit", "312K"],
                    ["Low stock", "6"],
                  ].map((x) => (
                    <div className="rounded-lg bg-white/[.07] p-3" key={x[0]}>
                      <small className="text-white/55">{x[0]}</small>
                      <b className="mt-1 block">{x[1]}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
                {[
                  [ScanLine, "Scan"],
                  [ShoppingCart, "Sell"],
                  [Boxes, "Stock"],
                  [BarChart3, "Reports"],
                ].map(([I, t]: any) => (
                  <div
                    className="rounded-xl border border-[#e7ece9] bg-white p-4 text-center"
                    key={t}
                  >
                    <I className="mx-auto text-emerald-700" />
                    <b className="mt-2 block text-xs">{t}</b>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
        <section id="features" className="mx-auto max-w-7xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-emerald-700">
              EVERYTHING CONNECTED
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              From a product scan to a clear business picture.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              [
                ScanLine,
                "Lightning-fast POS",
                "Scan continuously, calculate change and produce receipts in seconds.",
              ],
              [
                Boxes,
                "Stock that manages itself",
                "Sales reduce stock; purchases, refunds and stocktakes update the ledger.",
              ],
              [
                BarChart3,
                "Decisions with evidence",
                "Understand sales, profit, expenses, payments, staff and customer credit.",
              ],
              [
                ShieldCheck,
                "Business-grade control",
                "Roles, audit history, tenant isolation and founder-managed access.",
              ],
              [
                Download,
                "Receipts and reports",
                "Branded PDFs, thermal printing, WhatsApp sharing and exports.",
              ],
              [
                Store,
                "Built for real shops",
                "Affordable core features, offline resilience and full phone/desktop parity.",
              ],
            ].map(([I, t, c]: any) => (
              <Card className="bg-white/75 p-6 backdrop-blur" key={t}>
                <I className="text-emerald-700" />
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-[#62736b]">{c}</p>
              </Card>
            ))}
          </div>
        </section>
        <section
          id="pricing"
          className="mx-auto max-w-7xl px-5 py-24 text-center"
        >
          <h2 className="text-4xl font-semibold">
            Start simple. Upgrade when insight matters.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[#62736b]">
            Transparent plans for a single shop. Start free, then unlock the
            controls and intelligence your business needs.
          </p>
          <div className="mt-7 inline-flex rounded-xl border border-[#dce5e0] bg-white/80 p-1 shadow-sm">
            <button
              className={`rounded-lg px-5 py-2 text-sm font-semibold ${!pricingAnnual ? "bg-[#14271f] text-white" : ""}`}
              onClick={() => setPricingAnnual(false)}
            >
              Monthly
            </button>
            <button
              className={`rounded-lg px-5 py-2 text-sm font-semibold ${pricingAnnual ? "bg-[#14271f] text-white" : ""}`}
              onClick={() => setPricingAnnual(true)}
            >
              Annual <span className="text-emerald-600">Save 2 months</span>
            </button>
          </div>
          <div className="mt-8 grid gap-4 text-left md:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Free",
                0,
                "Try the essentials",
                ["10 products", "Core POS and receipts", "Readable live reports"],
              ],
              [
                "Starter",
                25000,
                "For a growing shop",
                [
                  "Unlimited products",
                  "Barcode and QR downloads",
                  "WhatsApp receipts",
                ],
              ],
              [
                "Business",
                50000,
                "Complete retail control",
                [
                  "Branded PDF reports",
                  "Staff and shifts",
                  "Credit and suppliers",
                ],
              ],
              [
                "Pro",
                100000,
                "Intelligence at scale",
                [
                  "Everything in Business",
                  "AI Business Adviser",
                  "Branded PDF downloads",
                ],
              ],
            ].map((x, i) => (
              <Card
                className={`relative flex min-h-[430px] flex-col overflow-hidden p-7 ${i === 2 ? "border-emerald-500 shadow-[0_24px_60px_rgba(13,122,83,.17)]" : ""}`}
                key={String(x[0])}
              >
                {i === 2 && (
                  <span className="absolute right-0 top-0 rounded-bl-xl bg-emerald-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                )}
                <span className="text-xs font-bold uppercase tracking-[.14em] text-muted">
                  {String(x[2])}
                </span>
                <b className="mt-4 text-2xl">{String(x[0])}</b>
                <div className="mt-4">
                  <strong className="text-3xl">
                    {Number(x[1]) === 0
                      ? "Free"
                      : `UGX ${(pricingAnnual ? Number(x[1]) * 10 : Number(x[1])).toLocaleString()}`}
                  </strong>
                  {Number(x[1]) > 0 && (
                    <small className="text-muted">
                      {" "}
                      / {pricingAnnual ? "year" : "month"}
                    </small>
                  )}
                </div>
                {pricingAnnual && Number(x[1]) > 0 && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    Two months included free
                  </p>
                )}
                <div className="my-6 h-px bg-line" />
                <ul className="space-y-3 text-sm">
                  {(x[3] as string[]).map((f) => (
                    <li className="flex gap-2" key={f}>
                      <span className="text-emerald-700">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-auto w-full"
                  variant={i === 2 ? "primary" : "secondary"}
                  onClick={() => setAuth("signup")}
                >
                  {i === 0 ? "Start free" : "Choose plan"}
                </Button>
              </Card>
            ))}
          </div>
        </section>
        <footer
          id="contact"
          className="border-t border-[#dce5e0] px-5 py-10 text-center text-sm text-[#62736b]"
        >
          NileStock by Nile AI Solutions •{" "}
          <a href="mailto:hello@nileai.solutions" className="text-emerald-700">
            hello@nileai.solutions
          </a>
        </footer>
      </main>
      <Modal
        open={!!auth}
        onClose={() => {
          setAuth(null);
          setAuthEmail("");
          setConfirmationEmail("");
          setAuthMessage("");
        }}
        title={
          confirmationEmail
            ? "Confirm your email"
            : auth === "signup"
              ? "Create your NileStock account"
              : "Welcome back"
        }
      >
        {confirmationEmail ? (
          <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-[radial-gradient(circle_at_50%_0%,rgba(82,212,154,.25),transparent_48%),linear-gradient(#ffffff,#f7fbf9)] p-6 text-center text-[#173126]">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-700 text-white shadow-[0_16px_35px_rgba(5,122,82,.25)]">
              <MailCheck size={30} />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">
              One secure step left
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              Check your inbox
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#617268]">
              We sent a private confirmation link to
              <strong className="mt-1 block break-all text-[#173126]">
                {confirmationEmail}
              </strong>
            </p>
            <div className="mt-5 rounded-xl border border-emerald-100 bg-white/80 p-4 text-left text-sm leading-6">
              <p><b>1.</b> Open the NileStock email.</p>
              <p><b>2.</b> Tap <b>Confirm my account</b>.</p>
              <p><b>3.</b> You will return securely to your shop.</p>
            </div>
            {authMessage && (
              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
                {authMessage}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              className="mt-5 w-full bg-white"
              disabled={resendBusy}
              onClick={() => void resendConfirmation()}
            >
              <RefreshCw size={16} className={resendBusy ? "animate-spin" : ""} />
              {resendBusy ? "Sending…" : "Resend confirmation email"}
            </Button>
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-emerald-800 hover:underline"
              onClick={() => {
                setConfirmationEmail("");
                setAuthMessage("");
              }}
            >
              Use a different email
            </button>
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#718178]">
              <ShieldCheck size={14} /> Secure confirmation by Supabase
            </p>
          </div>
        ) : (
        <form action={authenticate} className="grid gap-4">
          {auth === "signup" && (
            <>
              <Field label="Full name">
                <Input name="name" autoComplete="name" required />
              </Field>
              <Field label="Business name">
                <Input name="business" required />
              </Field>
            </>
          )}
          <Field label="Email">
            <Input
              name="email"
              type="email"
              autoComplete="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              name="password"
              type="password"
              autoComplete={auth === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </Field>
          {authMessage && (
            <p
              className={`rounded-xl p-3 text-sm ${authMessage.startsWith("Account created") ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
            >
              {authMessage}
            </p>
          )}
          <Button disabled={authBusy}>
            {authBusy
              ? "Please wait…"
              : auth === "signup"
                ? "Create account"
                : "Sign in"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <hr className="flex-1" />
            OR
            <hr className="flex-1" />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={authBusy}
            onClick={signInWithGoogle}
          >
            <span className="font-bold text-blue-600">G</span> Continue with
            Google
          </Button>
          <div className="rounded-xl bg-black/[.025] p-3 text-center text-sm dark:bg-white/[.04]">
            {auth === "signup" ? "Already have an account?" : "New to NileStock?"}{" "}
            <button
              type="button"
              className="font-bold text-accent hover:underline"
              onClick={() => {
                setAuthMessage("");
                setConfirmationEmail("");
                setAuth(auth === "signup" ? "login" : "signup");
              }}
            >
              {auth === "signup" ? "Sign in with email" : "Create an account"}
            </button>
          </div>
          <p className="text-center text-xs text-muted">
            {isSupabaseConfigured
              ? "Secure authentication and persistent sessions are provided by Supabase."
              : "Local demo mode is active until Supabase environment variables are added."}
          </p>
        </form>
        )}
      </Modal>
      <Modal
        open={googleProfile}
        onClose={() => setGoogleProfile(false)}
        title="Continue with Google"
      >
        <form
          action={(fd) => {
            login(String(fd.get("email")), String(fd.get("name")));
            setGoogleProfile(false);
          }}
          className="grid gap-4"
        >
          <p className="text-sm text-muted">
            Demo mode keeps your Google profile on this device. Your real Google
            name and email will be read automatically when cloud authentication
            is connected.
          </p>
          <Field label="Google account name">
            <Input name="name" autoComplete="name" required />
          </Field>
          <Field label="Google email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Button>
            <span className="font-bold">G</span> Continue
          </Button>
        </form>
      </Modal>
      <Modal
        open={installHelp}
        onClose={() => setInstallHelp(false)}
        title="Install NileStock"
      >
        <div className="space-y-3 text-sm">
          <p>
            If your browser does not show an automatic install prompt, use its
            menu and choose <b>Install app</b> or <b>Add to Home Screen</b>.
          </p>
          <p className="rounded-xl bg-emerald-50 p-4 text-emerald-950">
            On iPhone: open NileStock in Safari, tap <b>Share</b>, then tap
            <b> Add to Home Screen</b>.
          </p>
          <Button className="w-full" onClick={() => setInstallHelp(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </div>
  );
}
