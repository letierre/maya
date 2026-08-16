import { MainWrapper, BottomNavWrapper } from "@/components/DashboardChrome";
import { SleepCapture } from "@/components/SleepCapture";
import { ServiceWorkerNavListener } from "@/components/ServiceWorkerNavListener";
import { SessionGuard } from "@/components/SessionGuard";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SessionGuard />
      <ServiceWorkerNavListener />
      <SleepCapture />
      <MainWrapper>{children}</MainWrapper>
      <BottomNavWrapper />
    </div>
  );
}
