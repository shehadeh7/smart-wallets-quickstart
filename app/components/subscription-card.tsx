
// src/app/components/subscription-card.tsx
"use client";
import { useState, useEffect } from "react";
import { useSmartAccountClient, useUser } from "@account-kit/react";
import {
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import {
  installValidationActions,
  HookType,
  SingleSignerValidationModule,
  getDefaultSingleSignerValidationModuleAddress,
} from "@account-kit/smart-contracts/experimental";
import { sepolia } from "@account-kit/infra";

const SUBSCRIPTION_MODULE_ADDRESS = "0xe0ca7D210Ff0CC219072e1727ECB0f2BD67866ba";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const MERCHANT_ADDRESS = "0xdbcafd921b6b2e3d92d0d8b6489cf3d84dbf149f";

interface SubscriptionStatus {
  hasSubscription: boolean;
  isActive: boolean;
  isPaused: boolean;
  sessionKey?: string;
}

export default function SubscriptionCard() {
  const user = useUser();
  const { client } = useSmartAccountClient({ type: "ModularAccountV2" });

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // avoid initial flicker
  const [status, setStatus] = useState<SubscriptionStatus>({
    hasSubscription: false,
    isActive: false,
    isPaused: false,
  });

  // FIX: proper union type
  const [step, setStep] = useState<"setup" | "manage">("setup");

  useEffect(() => {
    const init = async () => {
      if (client && user) {
        await checkSubscriptionStatus();
      }
      setInitialLoading(false);
    };
    init();
  }, [client, user]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch("/api/subscription/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.userId,
          accountAddress: client?.account.address,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`check failed: ${response.status} ${text}`);
      }
      const data = await response.json();
      setStatus(data);
      setStep(data.hasSubscription ? "manage" : "setup");
    } catch (error) {
      console.error("Failed to check subscription:", error);
      // keep previous state on failure
    }
  };

  const setupSubscription = async () => {
    if (!client) return;

    // 🚫 Guard: don't allow duplicate setup attempts
    if (status.hasSubscription) {
      alert("You already have a subscription.");
      setStep("manage");
      return;
    }

    const userConsents = confirm(
      "By subscribing, you authorize Netflix to charge up to $10 per month from your smart account. You can pause or cancel anytime."
    );
    
    if (!userConsents) return;    

    setLoading(true);
    try {
      // Step 1: Create session (persisted private key + derived address on server)
      const sessionResponse = await fetch("/api/subscription/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.userId,
          accountAddress: client.account.address,
        }),
      });
      if (!sessionResponse.ok) {
        const text = await sessionResponse.text();
        throw new Error(`create-session failed: ${sessionResponse.status} ${text}`);
      }
      const { sessionKeyAddress } = await sessionResponse.json();

      // Step 2: Get installation data (now requires userId + accountAddress)
      const installResponse = await fetch("/api/subscription/install-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.userId,
          sessionKeyAddress,
          accountAddress: client.account.address,
        }),
      });
      if (!installResponse.ok) {
        const text = await installResponse.text();
        throw new Error(`install-data failed: ${installResponse.status} ${text}`);
      }
      const { validationConfig, installData, hooks } = await installResponse.json();

      // Step 3: Install validation + hooks (user signs once)
      const extendedClient = client.extend(installValidationActions);
      const result = await extendedClient.installValidation({
        validationConfig,
        selectors: [],
        installData,
        hooks,
      });
      await client.waitForUserOperationTransaction({ hash: result.hash });

      // Step 4: Confirm installation (persist subscription server-side)
      const confirmRes = await fetch("/api/subscription/confirm-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.userId,
          txHash: result.hash,
          sessionKey: sessionKeyAddress,
          accountAddress: client.account.address,
        }),
      });
      if (!confirmRes.ok) {
        const text = await confirmRes.text();
        throw new Error(`confirm-install failed: ${confirmRes.status} ${text}`);
      }

      // ✅ Optimistic UI: move to manage immediately
      setStatus((prev) => ({
        ...prev,
        hasSubscription: true,
        isActive: true,
        isPaused: false,
        sessionKey: sessionKeyAddress,
      }));
      setStep("manage");

      // 🔄 Reconcile with backend (and refresh if needed)
      await checkSubscriptionStatus();
      // Optional: if you have server components above this card:
      // const router = useRouter(); router.refresh();

      alert("✅ Subscription activated! Now fund your account with USDC.");
    } catch (error: any) {
      console.error("Setup failed:", error);
      alert("Setup failed: " + (error?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const pauseSubscription = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const result = await client.sendUserOperation({
        uo: {
          target: SUBSCRIPTION_MODULE_ADDRESS,
          data: encodeFunctionData({
            abi: [
              {
                name: "setPaused",
                type: "function",
                inputs: [{ name: "data", type: "bytes" }],
                outputs: [],
              },
            ],
            functionName: "setPaused",
            args: [
              encodeAbiParameters(
                parseAbiParameters("uint32 entityId, address merchant, bool paused"),
                [6, MERCHANT_ADDRESS, true]
              ),
            ],
          }),
          value: 0n,
        },
      });
      await client.waitForUserOperationTransaction({ hash: result.hash });

      const res = await fetch("/api/subscription/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.userId, paused: true }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`pause endpoint failed: ${res.status} ${text}`);
      }

      // Optimistic UI
      setStatus((prev) => ({ ...prev, isPaused: true }));
      setStep("manage");
      await checkSubscriptionStatus();
      alert("⏸️ Subscription paused");
    } catch (error: any) {
      console.error("Pause failed:", error);
      alert("Pause failed: " + (error?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const resumeSubscription = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const result = await client.sendUserOperation({
        uo: {
          target: SUBSCRIPTION_MODULE_ADDRESS,
          data: encodeFunctionData({
            abi: [
              {
                name: "setPaused",
                type: "function",
                inputs: [{ name: "data", type: "bytes" }],
                outputs: [],
              },
            ],
            functionName: "setPaused",
            args: [
              encodeAbiParameters(
                parseAbiParameters("uint32 entityId, address merchant, bool paused"),
                [6, MERCHANT_ADDRESS, false]
              ),
            ],
          }),
          value: 0n,
        },
      });
      await client.waitForUserOperationTransaction({ hash: result.hash });

      const res = await fetch("/api/subscription/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.userId, paused: false }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`resume endpoint failed: ${res.status} ${text}`);
      }

      // Optimistic UI
      setStatus((prev) => ({ ...prev, isPaused: false, isActive: true }));
      setStep("manage");
      await checkSubscriptionStatus();
      alert("▶️ Subscription resumed");
    } catch (error: any) {
      console.error("Resume failed:", error);
      alert("Resume failed: " + (error?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (
      !client ||
      !confirm("Cancel subscription? You'll need to set up again to resubscribe.")
    ) {
      return;
    }
    setLoading(true);
    try {
      const hookEntityId = 6;

      // (Optional) fetch session key info from server if you need entityId or address
      const sessionKeyResponse = await fetch("/api/subscription/session-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.userId }),
      });
      // Not strictly required if your uninstall flow uses fixed ids
      const { sessionKeyAddress, sessionKeyEntityId } = sessionKeyResponse.ok
        ? await sessionKeyResponse.json()
        : { sessionKeyAddress: status.sessionKey, sessionKeyEntityId: 2 }; // fallback

      const extendedClient = client.extend(installValidationActions);

      // Encode uninstall data for your subscription module hooks
      const hookUninstallData = encodeAbiParameters(
        parseAbiParameters("uint32 entityId, address merchant"),
        [hookEntityId, MERCHANT_ADDRESS]
      );

      // Uninstall the validation module and hooks
      const result = await extendedClient.uninstallValidation({
        moduleAddress: getDefaultSingleSignerValidationModuleAddress(sepolia),
        entityId: sessionKeyEntityId,
        uninstallData: SingleSignerValidationModule.encodeOnUninstallData({
          entityId: sessionKeyEntityId,
        }),
        hookUninstallDatas: [
          hookUninstallData, // Validation hook
          hookUninstallData, // Execution hook
        ],
      });

      await client.waitForUserOperationTransaction({ hash: result.hash });

      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.userId, txHash: result.hash }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`cancel endpoint failed: ${res.status} ${text}`);
      }

      await checkSubscriptionStatus();
      alert("❌ Subscription cancelled");
    } catch (error: any) {
      console.error("Cancel failed:", error);
      alert("Cancel failed: " + (error?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  // ---------- RENDER ----------
  if (initialLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold mb-4">Subscription</h2>
        <p className="text-sm text-muted-foreground">Loading subscription…</p>
      </div>
    );
  }

  // Render guards: never show "Activate" if we already have a subscription
  const showSetup = step === "setup" && !status.hasSubscription;
  const showManage = step === "manage" || status.hasSubscription;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-xl font-semibold mb-4">Subscription</h2>

      {showSetup ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set up automatic payments ($9.99/month)
          </p>
          <button
            onClick={setupSubscription}
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up..." : "Activate Subscription"}
          </button>
          <p className="text-xs text-muted-foreground">
            You'll sign once to approve automatic payments. Cancel anytime.
          </p>
        </div>
      ) : null}

      {showManage ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Status:</span>
            <span
              className={`text-sm font-semibold ${
                status.isPaused
                  ? "text-yellow-600"
                  : status.isActive
                  ? "text-green-600"
                  : "text-gray-600"
              }`}
            >
              {status.isPaused ? "Paused" : status.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="space-y-2">
            {status.isActive && !status.isPaused && (
              <button
                onClick={pauseSubscription}
                disabled={loading}
                className="w-full py-2 px-4 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "⏸️ Pause"}
              </button>
            )}

            {status.isPaused && (
              <button
                onClick={resumeSubscription}
                disabled={loading}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "▶️ Resume"}
              </button>
            )}

            {status.hasSubscription && (
              <button
                onClick={cancelSubscription}
                disabled={loading}
                className="w-full py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "❌ Cancel"}
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            $9.99/month • Auto-charged on billing date
          </p>
        </div>
      ) : null}
    </div>
  );
}
