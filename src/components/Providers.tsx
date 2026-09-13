"use client";

import { ToastProvider } from "@/components/toast";

/** Client-side context providers mounted once at the root layout. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
