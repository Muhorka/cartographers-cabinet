const subjectColors: Record<string, string> = {
  water: "#70a9bb",
  river: "#3f82ad",
  stream: "#5e9fc4",
  vegetation: "#63835f",
  forest: "#63835f",
  meadow: "#9dad69",
  field: "#bb9554",
  garden: "#819665",
};

/** Default semantic colour; an element appearance always takes precedence. */
export function defaultElementColor(subjectId: string, fallback = "#a99362") {
  return subjectColors[subjectId.split(".").at(-1) ?? ""] ?? fallback;
}
