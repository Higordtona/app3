import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

export async function registerNotifications(role: "technician" | "client", trackingCode?: string) {
  if (Platform.OS === "web") return;
  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;
  if (finalStatus !== "granted") finalStatus = (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== "granted") return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await api.registerToken(token, role, trackingCode);
}