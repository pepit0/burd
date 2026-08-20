import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import type { CustomerInfo, PurchasesOffering } from "react-native-purchases";
import { BURD_PRO_ENTITLEMENT_ID, isPurchasesSupported } from "@/lib/revenuecat";

export function isPaywallPurchaseSuccess(result: PAYWALL_RESULT): boolean {
  return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
}

export async function presentProPaywall(options?: {
  offering?: PurchasesOffering;
}): Promise<{ success: boolean; result: PAYWALL_RESULT }> {
  if (!isPurchasesSupported()) {
    return { success: false, result: PAYWALL_RESULT.ERROR };
  }

  const result = await RevenueCatUI.presentPaywall({
    displayCloseButton: true,
    offering: options?.offering,
  });

  return { success: isPaywallPurchaseSuccess(result), result };
}

export async function presentProPaywallIfNeeded(options?: {
  offering?: PurchasesOffering;
}): Promise<{ success: boolean; result: PAYWALL_RESULT }> {
  if (!isPurchasesSupported()) {
    return { success: false, result: PAYWALL_RESULT.ERROR };
  }

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: BURD_PRO_ENTITLEMENT_ID,
    displayCloseButton: true,
    offering: options?.offering,
  });

  return { success: isPaywallPurchaseSuccess(result), result };
}

export async function presentCustomerCenter(options?: {
  onRestoreCompleted?: (customerInfo: CustomerInfo) => void;
}): Promise<void> {
  if (!isPurchasesSupported()) return;

  await RevenueCatUI.presentCustomerCenter({
    callbacks: {
      onRestoreCompleted: ({ customerInfo }) => {
        options?.onRestoreCompleted?.(customerInfo);
      },
    },
  });
}
