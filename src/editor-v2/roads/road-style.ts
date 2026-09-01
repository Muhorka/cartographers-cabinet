import type { DrawingElement } from "../model/project-model";

export const roadWidthFor = (subjectId: string) => ({ "road.paved": 6, "road.dirt": 3, "road.path": 1.5, "road.sidewalk": 2 }[subjectId] ?? 4);
export const roadColor = (subjectId: string) => ({ "road.paved": "#817b6b", "road.dirt": "#aa895a", "road.path": "#b29e72", "road.sidewalk": "#c1b695" }[subjectId] ?? "#aa895a");
export const roadAppearance = (element: Pick<DrawingElement, "subjectId" | "appearance">) => ({ fillColor: element.appearance?.fillColor ?? roadColor(element.subjectId), fillOpacity: element.appearance?.fillOpacity ?? .7 });
