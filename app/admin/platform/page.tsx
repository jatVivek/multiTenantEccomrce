import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/src/lib/auth";
import { getAdminById } from "@/lib/db/queries/admin";
import {
  getAllSubscriptionPlans,
  getAllBrandSubscriptions,
  getAllPlatformSecrets,
  getDailySafetyCap,
  getPlatformAuditLogs,
  getAllPlatformSettings,
} from "@/lib/db/queries/platform";
import PlatformConsoleClient from "@/components/admin/platform/PlatformConsoleClient";

export default async function PlatformAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) {
    redirect("/admin/login");
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect("/admin/login");
  }

  const admin = await getAdminById(payload.userId);
  if (!admin) {
    redirect("/admin/login");
  }

  // Strict role isolation: SUPER_ADMIN ONLY
  if (admin.role !== "SUPER_ADMIN") {
    redirect("/admin?error=unauthorized_platform");
  }

  // Fetch all platform data
  const [plans, clients, secrets, dailyCap, auditLogs, platformSettings] = await Promise.all([
    getAllSubscriptionPlans(),
    getAllBrandSubscriptions(),
    getAllPlatformSecrets(),
    getDailySafetyCap(),
    getPlatformAuditLogs(40),
    getAllPlatformSettings(),
  ]);

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      <PlatformConsoleClient
        plans={plans}
        clients={clients}
        platformSecrets={secrets}
        dailySafetyCap={dailyCap}
        auditLogs={auditLogs}
        platformSettings={platformSettings}
      />
    </div>
  );
}
