import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { removePushToken, savePushToken } from "@/lib/activity";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationRouteData = {
  activity_id?: string;
  type?: string;
  sighting_id?: string;
  actor_id?: string;
};

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Burd",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#5f9470",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn("Missing EAS project ID — push tokens require app.json extra.eas.projectId");
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  const platform =
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : Platform.OS === "web"
          ? "web"
          : "unknown";

  await savePushToken(userId, token, platform);
  return token;
}

export async function unregisterPushNotifications(token: string | null): Promise<void> {
  if (!token) return;
  await removePushToken(token);
}

export function parseNotificationData(
  data: Record<string, unknown> | undefined,
): NotificationRouteData {
  if (!data) return {};
  return {
    activity_id: typeof data.activity_id === "string" ? data.activity_id : undefined,
    type: typeof data.type === "string" ? data.type : undefined,
    sighting_id: typeof data.sighting_id === "string" ? data.sighting_id : undefined,
    actor_id: typeof data.actor_id === "string" ? data.actor_id : undefined,
  };
}

export function routeFromNotificationData(
  data: NotificationRouteData,
): string | null {
  if (data.sighting_id) return `/post/${data.sighting_id}`;
  if (data.type === "follow" && data.actor_id) return `/user/${data.actor_id}`;
  if (data.actor_id) return `/user/${data.actor_id}`;
  return "/notifications";
}
