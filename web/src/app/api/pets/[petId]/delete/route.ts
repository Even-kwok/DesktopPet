import { handlePetDeleteRequest, type PetRouteContext } from "@/lib/server/pet-delete-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function POST(request: Request, context: PetRouteContext) {
  return handlePetDeleteRequest(request, context);
}
