import { redirect } from "next/navigation";

/**
 * Root page — immediately redirects to /login.
 * All authenticated routes will redirect back here if the JWT is invalid.
 */
export default function RootPage() {
  redirect("/login");
}
