"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EditorProject } from "../../model/project-model";
import { projectRevision, valueRevision } from "../../state/project-revision";
import type { StoryObjectRef } from "../types";
import { storyRefKey } from "../types";
import { createStoryRouteCalculationService, type StoryRouteCalculationService } from "../routes/route-service";
import type { StoryRouteRecord } from "../routes/types";
import { createSceneCheckService } from "../review/scene-check-service";
import { intentionsForScope } from "../review/scope";
import type { IntentionReviewResult, ReviewContext, SceneReviewReport } from "../review/types";
import { reviewCopy, reviewDiagnostic } from "../i18n/review-copy";
import styles from "./story-intention-review.module.css";

export type StoryIntentionReviewProps = {
  project: EditorProject;
  context: ReviewContext;
  refs?: readonly StoryObjectRef[];
  locale: "pl" | "en";
  onFocus(refs: StoryObjectRef[]): void;
  onOpenRoute(id: string): void;
  onRequestRoute?(): void;
  onPreviewRoute?(route?: StoryRouteRecord): void;
  routeService?: StoryRouteCalculationService;
};
type RunState = "idle" | "running" | "complete" | "cancelled" | "stale" | "error";

function ResultCard({ checked, project, locale, onFocus, onOpenRoute, onPreviewRoute }: Pick<StoryIntentionReviewProps, "project" | "locale" | "onFocus" | "onOpenRoute" | "onPreviewRoute"> & { checked: IntentionReviewResult }) {
  const c = reviewCopy[locale];
  const worldName = (id: string) => project.story.world.find((item) => item.id === id)?.name ?? id;
  const name = (id: string) => { const matches = checked.facts.filter((fact) => fact.ref.id === id); return matches.length === 1 ? matches[0]!.name : matches.length > 1 ? id : worldName(id); };
  const diagnostic = (message: string) => reviewDiagnostic(message, locale, name);
  const showRoute = () => {
    if (!checked.result || !checked.query || !onPreviewRoute) return;
    onPreviewRoute({ id: `review-${checked.intentionId}`, name: checked.intention?.text ?? checked.intentionId, query: checked.query, result: checked.result, sourceRevision: checked.result.sourceRevision });
  };
  return <article className={styles.result} data-review-status={checked.status}>
    <div className={styles.resultTitle}><h3>{checked.intention?.text ?? checked.intentionId}</h3><strong className={styles.badge}>{c.statuses[checked.status]}</strong></div>
    {checked.intention && <small>{c.author[checked.intention.status]}</small>}
    <p>{c.reasons[checked.reasonCode]}</p><p className={styles.scopeNote}>{c.proof[checked.proofScope]}</p>
    {checked.access && <p>{checked.access.physicalOpen ? c.physicalOpen : c.physicalClosed}</p>}
    {checked.conditions.length > 0 && <div><strong>{c.conditions}</strong><ul>{checked.conditions.map((condition, index) => <li key={index}>{diagnostic(condition)}</li>)}</ul></div>}
    {checked.missingFacts.length > 0 && <div><strong>{c.missing}</strong><ul>{checked.missingFacts.map((fact, index) => <li key={index}>{diagnostic(fact)}</li>)}</ul></div>}
    {checked.result?.route && <p>{c.distance}: {checked.result.route.distance.toLocaleString(locale, { maximumFractionDigits: 2 })} m</p>}
    <div className={styles.actions}>
      {checked.refs.length > 0 && <button type="button" onClick={() => onFocus(checked.evidence?.refs?.length ? checked.evidence.refs : checked.refs)}>{c.focus}</button>}
      {checked.result?.route && onPreviewRoute && <button type="button" onClick={showRoute}>{c.showCalculated}</button>}
      {checked.routeId && <button type="button" onClick={() => onOpenRoute(checked.routeId!)}>{c.openRoute}</button>}
    </div>
    <details className={styles.sources}><summary>{c.sources} ({checked.facts.length + checked.localEvidence.length})</summary>
      {checked.facts.map((fact) => <div key={storyRefKey(fact.ref)} className={styles.fact}>
        <button type="button" onClick={() => onFocus([fact.ref])}>{fact.name}</button>{fact.description && <p>{fact.description}</p>}
        {fact.metadata.access && (["allow", "deny", "keyIds"] as const).map((field) => fact.metadata.access![field].length > 0 && <p key={field}>{field === "keyIds" ? c.keys : c[field]}: {fact.metadata.access![field].map(worldName).join(", ")}</p>)}
        {fact.effectiveProperties.length > 0 && <dl>{fact.effectiveProperties.map((property) => {
          const kind = property.source.split(":")[0] as keyof typeof c.provenance;
          const propertyName = project.story.propertyDefinitions.find(({ id }) => id === property.propertyId)?.name ?? property.propertyId;
          return <div key={property.propertyId}><dt>{propertyName}</dt><dd>{typeof property.value === "string" ? property.value : JSON.stringify(property.value)} <small title={property.source}>{c.source}: {c.provenance[kind] ?? property.source}</small></dd></div>;
        })}</dl>}
        {fact.conflicts.length > 0 && <p className={styles.warning}>{c.conflicts}: {fact.conflicts.join(", ")}</p>}
      </div>)}
      {checked.localEvidence.length > 0 && <div><strong>{c.local}</strong>{checked.localEvidence.map((item) => <blockquote key={item.id}>{item.text}{item.locator && <cite>{item.locator}</cite>}</blockquote>)}</div>}
      {checked.sourcesTruncated && <p>{c.sourceLimit}</p>}
    </details>
    {checked.execution === "error" && <details><summary>{c.diagnostic}</summary><p>{checked.reason}</p></details>}
  </article>;
}

/** Transient proof panel: never writes story, statuses or calculated routes back to the project. */
export function StoryIntentionReview({ project, context, refs, locale, onFocus, onOpenRoute, onRequestRoute, onPreviewRoute, routeService }: StoryIntentionReviewProps) {
  const c = reviewCopy[locale];
  const [actorId, setActorId] = useState(""); const [routeId, setRouteId] = useState(""); const [all, setAll] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle"); const [report, setReport] = useState<SceneReviewReport>();
  const [reportKey, setReportKey] = useState<string>();
  const routes = useMemo(() => routeService ?? createStoryRouteCalculationService(), [routeService]);
  const checks = useMemo(() => createSceneCheckService(routes), [routes]);
  const epoch = useRef(0); const currentKey = useRef("");
  const previewRef = useRef(onPreviewRoute);
  useLayoutEffect(() => { previewRef.current = onPreviewRoute; }, [onPreviewRoute]);
  const scope = all ? undefined : refs;
  const intentionList = intentionsForScope(project, scope);
  const revision = projectRevision(project);
  const signature = valueRevision({ revision, context, scope, actorId, routeId });
  useLayoutEffect(() => { currentKey.current = signature; }, [signature]);
  // Invalidation is permanent for the attempt, including an A→B→A context round trip.
  useLayoutEffect(() => () => {
    epoch.current += 1;
    checks.cancel();
    previewRef.current?.();
    setRunState((state) => state === "idle" ? "idle" : "stale");
  }, [checks, signature]);
  const visibleState = (runState === "complete" || runState === "running") && reportKey !== signature ? "stale" : runState;
  const scenario = project.story.scenarios.find(({ id }) => id === context.scenarioId);
  const step = scenario?.steps.find(({ id }) => id === context.stepId);

  async function run() {
    const attempt = ++epoch.current;
    onPreviewRoute?.();
    setReport(undefined); setReportKey(signature); setRunState("running");
    try {
      const observation = await checks.check(project, { refs: scope, actorId: actorId || undefined, routeId: routeId || undefined, context }, () => currentKey.current === signature && epoch.current === attempt);
      if (epoch.current !== attempt) return;
      if (currentKey.current !== signature) { setRunState("stale"); return; }
      setReport(observation); setRunState(observation.status);
    } catch {
      if (epoch.current === attempt) setRunState("error");
    }
  }
  function cancel() { epoch.current += 1; checks.cancel(); onPreviewRoute?.(); setReport(undefined); setRunState("cancelled"); }

  return <section className={styles.panel} aria-label={c.title}>
    <h2>{c.title}</h2><p>{c.intro}</p>
    <p className={styles.context}>{c.scenario}: <strong>{scenario?.name ?? context.scenarioId ?? c.base}</strong>{context.stepId && <> · {c.step}: <strong>{step?.name ?? context.stepId}</strong></>}</p>
    <label>{c.actor}<select value={actorId} onChange={(event) => setActorId(event.currentTarget.value)}><option value="">{c.defaultActor}</option>{project.story.world.filter(({ kind }) => kind !== "key").map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>
    <label>{c.route}<select value={routeId} onChange={(event) => setRouteId(event.currentTarget.value)}><option value="">{c.noRoute}</option>{project.story.routes.map((route) => <option value={route.id} key={route.id}>{route.name}</option>)}</select></label>
    {routeId && <p className={styles.scopeNote}>{c.freshRoute}</p>}
    {onRequestRoute && <button type="button" onClick={onRequestRoute}>{c.requestRoute}</button>}
    {refs !== undefined && <label className={styles.checkbox}><input type="checkbox" checked={all} onChange={(event) => setAll(event.currentTarget.checked)}/>{c.all}</label>}
    <details><summary>{c.scope} ({intentionList.length})</summary><ul>{intentionList.map((intention) => <li key={intention.id}>{intention.text}</li>)}</ul></details>
    {!intentionList.length && <p>{c.empty}</p>}
    <div className={styles.actions}><button type="button" disabled={!intentionList.length || visibleState === "running"} onClick={() => void run()}>{visibleState === "running" ? c.running : c.check}</button>{visibleState === "running" && <button type="button" onClick={cancel}>{c.cancel}</button>}</div>
    {visibleState === "stale" && <p role="status" className={styles.warning}>{c.stale}</p>}
    {visibleState === "cancelled" && <p role="status">{c.cancelled}</p>}
    {visibleState === "error" && <p role="alert">{c.error}</p>}
    {visibleState === "complete" && report && <div role="status" className={styles.results}>
      <p>{c.coverage} {report.results.length} {c.of} {report.total}</p>{report.truncated && <p className={styles.warning}>{c.limited}</p>}
      {report.results.map((checked) => <ResultCard key={checked.intentionId} checked={checked} project={project} locale={locale} onFocus={onFocus} onOpenRoute={onOpenRoute} onPreviewRoute={onPreviewRoute}/>)}
    </div>}
  </section>;
}
