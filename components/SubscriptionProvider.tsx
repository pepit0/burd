import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Purchases, {
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesOfferings,
} from "react-native-purchases";
import { PAYWALL_RESULT } from "react-native-purchases-ui";
import {
  BURD_PRO_ENTITLEMENT_DISPLAY_NAME,
  configureRevenueCat,
  fetchCustomerInfo,
  fetchOfferings,
  formatPurchasesError,
  getActiveProEntitlement,
  isProEntitlementActive,
  isPurchasesSupported,
  logInRevenueCat,
  logOutRevenueCat,
  restorePurchases,
} from "@/lib/revenuecat";
import {
  presentCustomerCenter,
  presentProPaywall,
  presentProPaywallIfNeeded,
} from "@/lib/revenuecatPaywall";
import { BURD_PRO_ENABLED } from "@/lib/burdProEnabled";

interface SubscriptionContextValue {
  supported: boolean;
  ready: boolean;
  loading: boolean;
  error: string | null;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  isPro: boolean;
  proEntitlement: PurchasesEntitlementInfo | null;
  entitlementDisplayName: string;
  refresh: () => Promise<void>;
  restore: () => Promise<boolean>;
  showPaywall: () => Promise<boolean>;
  showPaywallIfNeeded: () => Promise<PAYWALL_RESULT>;
  showCustomerCenter: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const DISABLED_SUBSCRIPTION_VALUE: SubscriptionContextValue = {
  supported: false,
  ready: true,
  loading: false,
  error: null,
  customerInfo: null,
  offerings: null,
  isPro: false,
  proEntitlement: null,
  entitlementDisplayName: BURD_PRO_ENTITLEMENT_DISPLAY_NAME,
  refresh: async () => {},
  restore: async () => false,
  showPaywall: async () => false,
  showPaywallIfNeeded: async () => PAYWALL_RESULT.NOT_PRESENTED,
  showCustomerCenter: async () => {},
};

export function SubscriptionProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  if (!BURD_PRO_ENABLED) {
    return (
      <SubscriptionContext.Provider value={DISABLED_SUBSCRIPTION_VALUE}>
        {children}
      </SubscriptionContext.Provider>
    );
  }

  return <SubscriptionProviderActive userId={userId}>{children}</SubscriptionProviderActive>;
}

function SubscriptionProviderActive({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const supported = isPurchasesSupported();
  const [ready, setReady] = useState(!supported);
  const [loading, setLoading] = useState(supported);
  const [error, setError] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const identityRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supported) return;

    setLoading(true);
    setError(null);
    try {
      const [info, currentOfferings] = await Promise.all([
        fetchCustomerInfo(),
        fetchOfferings(),
      ]);
      setCustomerInfo(info);
      setOfferings(currentOfferings);
    } catch (err) {
      setError(formatPurchasesError(err));
    } finally {
      setLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      const configured = await configureRevenueCat();
      if (!configured || cancelled) {
        if (!cancelled) setReady(true);
        return;
      }

      removeListener = Purchases.addCustomerInfoUpdateListener((info) => {
        if (!cancelled) {
          setCustomerInfo(info);
        }
      });

      await refresh();
      if (!cancelled) {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [refresh, supported]);

  useEffect(() => {
    if (!supported || !ready) return;

    let cancelled = false;

    void (async () => {
      if (userId) {
        if (identityRef.current === userId) return;
        identityRef.current = userId;
        const info = await logInRevenueCat(userId);
        if (!cancelled && info) {
          setCustomerInfo(info);
        }
      } else if (identityRef.current) {
        identityRef.current = null;
        await logOutRevenueCat();
        const info = await fetchCustomerInfo();
        if (!cancelled) {
          setCustomerInfo(info);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, supported, userId]);

  const restore = useCallback(async () => {
    if (!supported) return false;
    setLoading(true);
    setError(null);
    try {
      const info = await restorePurchases();
      setCustomerInfo(info);
      return isProEntitlementActive(info);
    } catch (err) {
      setError(formatPurchasesError(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const showPaywall = useCallback(async () => {
    if (!supported) return false;
    setError(null);
    try {
      const { success } = await presentProPaywall({
        offering: offerings?.current ?? undefined,
      });
      await refresh();
      return success;
    } catch (err) {
      setError(formatPurchasesError(err));
      return false;
    }
  }, [offerings?.current, refresh, supported]);

  const showPaywallIfNeeded = useCallback(async () => {
    if (!supported) return PAYWALL_RESULT.ERROR;
    setError(null);
    try {
      const { result } = await presentProPaywallIfNeeded({
        offering: offerings?.current ?? undefined,
      });
      await refresh();
      return result;
    } catch (err) {
      setError(formatPurchasesError(err));
      return PAYWALL_RESULT.ERROR;
    }
  }, [offerings?.current, refresh, supported]);

  const showCustomerCenter = useCallback(async () => {
    if (!supported) return;
    setError(null);
    try {
      await presentCustomerCenter({
        onRestoreCompleted: (info) => {
          setCustomerInfo(info);
        },
      });
      await refresh();
    } catch (err) {
      setError(formatPurchasesError(err));
    }
  }, [refresh, supported]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      supported,
      ready,
      loading,
      error,
      customerInfo,
      offerings,
      isPro: isProEntitlementActive(customerInfo),
      proEntitlement: getActiveProEntitlement(customerInfo),
      entitlementDisplayName: BURD_PRO_ENTITLEMENT_DISPLAY_NAME,
      refresh,
      restore,
      showPaywall,
      showPaywallIfNeeded,
      showCustomerCenter,
    }),
    [
      supported,
      ready,
      loading,
      error,
      customerInfo,
      offerings,
      refresh,
      restore,
      showPaywall,
      showPaywallIfNeeded,
      showCustomerCenter,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}
