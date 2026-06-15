import { StudioApp } from "@/components/studio/studio-app";
import { getStudioBootstrap } from "@/lib/server/studio-data";

export default function HomePage() {
  return <StudioApp initialData={getStudioBootstrap()} />;
}
