import type { NarrationAction, Scene } from "./types";

export interface SessionState {
  chapter: number;
  part: string;
  latestTitle: string;
  latestNarration: string;
  latestSceneId: string;
  latestNarrationId: string;
  latestMoment: number;
  actions: NarrationAction[];
}

export function getSessionState(scenes: Scene[] | null | undefined): SessionState {
  const sorted = [...(scenes ?? [])].sort(
    (a, b) => (b.chapter ?? 0) - (a.chapter ?? 0) || (b.moment ?? 0) - (a.moment ?? 0)
  );
  const latestScene = sorted[0];
  const latestNarrations = latestScene?.narrations ?? [];
  const latestNarration = latestNarrations[latestNarrations.length - 1];
  const chapter = latestScene?.chapter ?? 1;
  const latestMoment = latestScene?.moment ?? 0;
  const latestTitle = latestNarration?.title ?? latestScene?.title ?? "";
  const latestNarrationText = latestNarration?.narration ?? "";
  const latestSceneId = latestScene?.id ?? "";
  const part = latestScene ? `${(latestScene.moment ?? 0) + 1}.${latestNarrations.length}` : "1";
  return {
    chapter,
    part,
    latestTitle,
    latestNarration: latestNarrationText,
    latestSceneId,
    latestMoment,
    actions: latestNarration?.actions ?? [],
    latestNarrationId: latestNarration?.id ?? "",
  };
}
