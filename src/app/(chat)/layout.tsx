import { Suspense } from "react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh]">
      <Suspense>{children}</Suspense>
    </div>
  );
}
