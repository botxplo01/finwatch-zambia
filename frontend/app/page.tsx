import { redirect } from "next/navigation";

/**
 * Root page
 */
export default function RootPage() {
  redirect(\"/sme/auth/login\");
}
