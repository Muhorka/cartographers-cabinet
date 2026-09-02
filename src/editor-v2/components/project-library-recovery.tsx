import type { ProjectLibraryCopy } from "../i18n/project-library-copy";
import type { ProjectLibraryRecoveryRecord } from "../persistence/project-library";
import styles from "./project-library-recovery.module.css";

function displayPrimaryKey(key: IDBValidKey) {
  return typeof key === "string" ? key : JSON.stringify(key);
}

export function ProjectLibraryRecovery({ records, copy, blocking, onExport, onCreate }: {
  records: readonly ProjectLibraryRecoveryRecord[];
  copy: ProjectLibraryCopy;
  blocking?: boolean;
  onExport(record: ProjectLibraryRecoveryRecord): void;
  onCreate?(): void;
}) {
  if (!records.length) return null;
  return <section className={`${styles.notice}${blocking ? ` ${styles.blocking}` : ""}`} role="alert" aria-live="polite">
    <h1>{blocking ? copy.recoveryOnlyTitle : copy.recoveryWarning(records.length)}</h1>
    {blocking && <p>{copy.recoveryOnlyBody(records.length)}</p>}
    <p>{copy.recoverySafety}</p>
    {blocking && onCreate && <button type="button" onClick={onCreate}>{copy.createNewProject}</button>}
    <div className={styles.records}>{records.map((record, index) => <article className={styles.record} key={`${displayPrimaryKey(record.primaryKey)}-${index}`}>
      <div><strong>{copy.recoveryKey}: {displayPrimaryKey(record.primaryKey)}</strong><small>{record.reason}</small></div>
      <button type="button" onClick={() => onExport(record)}>{copy.exportRecovery}</button>
    </article>)}</div>
  </section>;
}
