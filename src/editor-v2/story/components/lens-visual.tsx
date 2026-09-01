import type { CSSProperties } from "react";
import styles from "./lens-visual.module.css";

export function LensSwatch({ color, size = "small", clear = false }: { color?: string; size?: "small" | "large"; clear?: boolean }) {
  const className = `${styles.lens} ${size === "large" ? styles.large : styles.small}${clear ? ` ${styles.clear}` : ""}`;
  return <span aria-hidden="true" className={className} style={clear ? undefined : { "--lens-color": color ?? "#8a7043" } as CSSProperties} />;
}
