import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
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
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    void Notifications.getPermissionsAsync().then(({ status }) => {
      setPermissionGranted(status === "granted");
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (!userId) {
      void unregisterPushNotifications(tokenRef.current);
      tokenRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      const token = await registerForPushNotifications(userId);
      if (!cancelled) {
        tokenRef.current = token;
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionGranted(status === "granted");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === "web") return;

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

  return { permissionGranted };
}
