import { Redirect } from "expo-router";

/** Legacy route — redirects to Preferences hub. */
export default function ProfileSettingsRedirect() {
  return <Redirect href={"/preferences" as never} />;
}
