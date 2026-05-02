import { ReactNode } from "react";
import EscalationModal from "@/components/app-shell/escalation-modal";
import Header from "@/components/app-shell/header";
import NewPatientBanner from "@/components/app-shell/new-patient-banner";
import { StoreProvider } from "@/components/app-shell/store";
import Toast from "@/components/app-shell/toast";
import { C } from "@/lib/tokens";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
        <Header />
        <NewPatientBanner />
        {children}
        <EscalationModal />
        <Toast />
      </div>
    </StoreProvider>
  );
}
