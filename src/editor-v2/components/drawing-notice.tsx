import styles from "./drawing-notice.module.css";

export type DrawingNoticeModel = {
  message: string;
  tone?: "ordinary" | "warning";
  actions: { id: string; label: string; primary?: boolean; destructive?: boolean; onClick(): void }[];
};

export function DrawingNotice({ notice }: { notice?: DrawingNoticeModel }) {
  if (!notice) return null;
  return <section className={`${styles.notice}${notice.tone === "warning" ? ` ${styles.warning}` : ""}`} aria-live="polite">
    <p>{notice.message}</p>
    <div>{notice.actions.map((action) => <button key={action.id} type="button" className={`${action.primary ? styles.primary : ""}${action.destructive ? ` ${styles.destructive}` : ""}`} onClick={action.onClick}>{action.label}</button>)}</div>
  </section>;
}
