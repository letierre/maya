import { HeaderWrapper, MainWrapper, BottomNavWrapper } from "@/components/DashboardChrome";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <HeaderWrapper />
      <MainWrapper>{children}</MainWrapper>
      <BottomNavWrapper />
    </div>
  );
}
