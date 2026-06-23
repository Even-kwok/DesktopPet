import { NextResponse } from "next/server";
import { buildAdminOverview } from "@/lib/admin-overview";
import { materialGroups } from "@/lib/material-slots";
import { loadAdminAccountDataState } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { listPublicMaterialSlots } from "@/lib/server/material-library-store";
import {
  listAdminRechargeRecords,
  listAdminReferralCodes,
  listAdminReferralRewards
} from "@/lib/server/referral-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  const [accountState, materialSlots, referralCodes, referralRewards, rechargeRecords] = await Promise.all([
    loadAdminAccountDataState(),
    listPublicMaterialSlots(),
    listAdminReferralCodes(),
    listAdminReferralRewards(),
    listAdminRechargeRecords()
  ]);

  return NextResponse.json(
    buildAdminOverview({
      users: accountState.users,
      pets: accountState.pets,
      assets: accountState.assets,
      friends: accountState.friends,
      hostingRequests: accountState.hostingRequests,
      materialSlots,
      materialGroups,
      referralCodes,
      referralRewards,
      rechargeRecords
    })
  );
}
