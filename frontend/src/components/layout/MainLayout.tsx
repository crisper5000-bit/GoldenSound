import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Header />
      <main className="main">{children}</main>
      <Footer />
    </div>
  );
}
