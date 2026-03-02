"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={(path) => router.push(String(path))}>
      {children}
      <Toaster richColors theme="dark" position="top-right" />
    </HeroUIProvider>
  );
}
