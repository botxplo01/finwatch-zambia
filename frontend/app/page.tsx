import { redirect } from "next/navigation";

/**
 * Root page
 */
export default function RootPage() {
  redirect("/login");
}
