import { AppNavigation } from "@/components/AppNavigation";
import { requirePageUser } from "@/features/auth/page-session";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageUser();
  return (
    <div className="app-shell">
      <AppNavigation user={user} />
      <main id="main-content" className="app-main">{children}</main>
    </div>
  );
}
