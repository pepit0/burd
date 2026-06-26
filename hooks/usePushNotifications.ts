import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  parseNotificationData,
  registerForPushNotifications,
  routeFromNotificationData,
  unregisterPushNotifications,
} from "@/lib/pushNotifications";

export function usePushNotifications(userId: string | null) {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      void unregisterPushNotifications(tokenRef.current);
      tokenRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      const token = await registerForPushNotifications(userId);
      if (!cancelled) tokenRef.current = token;
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const openFromResponse = (response: Notifications.NotificationResponse) => {
      const data = parseNotificationData(
        response.notification.request.content.data as Record<string, unknown>,
      );
      const route = routeFromNotificationData(data);
      if (route) router.push(route as never);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(openFromResponse);

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openFromResponse(response);
    });

    return () => {
      sub.remove();
    };
  }, [router]);
}
