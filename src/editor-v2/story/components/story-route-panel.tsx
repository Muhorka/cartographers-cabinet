"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EditorProject } from "../../model/project-model";
import { isStoryRouteCurrent, storyRouteRevision } from "../routes/revision";
import { insidePoint } from "../routes/geometry";
import { routeWidth } from "../routes/width";
import type { StoryRouteRecord, StoryRouteRequest } from "../routes/types";
import type { StoryRouteCalculationService } from "../routes/route-service";
import { createRouteDiagnosticFormatter } from "../routes/route-diagnostic-display";
import type { StoryViewContext } from "../types";
import { endpointForOption, endpointOptionId, storyRouteEndpointOptions, type StoryRouteEndpoint } from "../routes/endpoints";
import styles from "./story-route-panel.module.css";
import { storyRouteEndpointVisibleOnPlace, storyRouteSegmentVisibleOnPlace } from "../routes/visibility";

type RoutePreference = "preferRoads" | "allowOffroad" | "allowWindows";
type StoryRoutePanelProps = {
  project: EditorProject; activePlaceId?: string; locale: "pl" | "en"; context: StoryViewContext;
  initialRoute?: StoryRouteRecord; onDelete?(id: string): void;
  onPreview(route?: StoryRouteRecord): void; onSave(route: StoryRouteRecord): void; onOpenPlace?(id: string): void;
  onRequestPoint?(endpoint: "from" | "to", accept: (value: StoryRouteEndpoint) => void): void;
  routeService?: StoryRouteCalculationService;
};
type CalculationKey = {
  projectId: string; revision: string; query: string;
  scenarioId?: string; stepId?: string;
  routeService?: StoryRouteCalculationService;
};
function routeQuerySignature(query: StoryRouteRequest) {
  return JSON.stringify({ from: query.from, to: query.to, profile: query.profile ?? "foot", actorId: query.actorId || undefined, widthOverride: query.width, preferences: query.preferences ?? {}, scenarioId: query.scenarioId, stepId: query.stepId });
}

function routePlaceName(project: EditorProject, id: string) {
  return project.places.find(({ id: placeId }) => placeId === id)?.name ?? id;
}

function routeSheetLabel(pl: boolean, count: number) {
  if (!pl) return `${count} ${count === 1 ? "sheet" : "sheets"}`;
  if (count === 1) return "1 arkusz";
  if (count >= 2 && count <= 4) return `${count} arkusze`;
  return `${count} arkuszy`;
}

export function StoryRoutePanel({ project, activePlaceId, locale, context, initialRoute, onDelete, onPreview, onSave, onOpenPlace, onRequestPoint, routeService }: StoryRoutePanelProps) {
  const pl = locale === "pl";
  const { scenarioId, stepId, lensId } = context;
  const diagnosticFormatter = useMemo(() => createRouteDiagnosticFormatter(project, locale, { scenarioId, stepId, lensId }), [project, locale, scenarioId, stepId, lensId]);
  const endpointOptions = storyRouteEndpointOptions(project);
  const firstOption = endpointOptions.find(({ kind, placeId }) => kind === "place" && placeId === activePlaceId) ?? endpointOptions[0];
  const initialEndpoint = firstOption ? endpointForOption(firstOption) : { placeId: "", point: insidePoint(undefined) };
  const [name, setName] = useState(initialRoute?.name ?? ""); const [from, setFrom] = useState<StoryRouteEndpoint>(initialRoute?.query.from ?? initialEndpoint);
  const [to, setTo] = useState<StoryRouteEndpoint>(initialRoute?.query.to ?? initialEndpoint); const [profile, setProfile] = useState<StoryRouteRequest["profile"]>(initialRoute?.query.profile ?? "foot");
  const [fromOptionId, setFromOptionId] = useState(initialRoute ? endpointOptionId(endpointOptions, initialRoute.query.from) : firstOption?.id ?? "");
  const [toOptionId, setToOptionId] = useState(initialRoute ? endpointOptionId(endpointOptions, initialRoute.query.to) : firstOption?.id ?? "");
  // Existing saved queries already contain an explicit point. Only a newly
  // selected water object needs confirmation at a concrete user-picked point.
  const [fromPointConfirmed, setFromPointConfirmed] = useState(Boolean(initialRoute));
  const [toPointConfirmed, setToPointConfirmed] = useState(Boolean(initialRoute));
  const [actorId, setActorId] = useState(initialRoute?.query.actorId ?? ""); const [widthOverride, setWidthOverride] = useState<number | undefined>(initialRoute?.query.width);
  const [preferences, setPreferences] = useState<StoryRouteRequest["preferences"]>(initialRoute?.query.preferences ?? {});
  const [result, setResult] = useState<StoryRouteRecord | undefined>(initialRoute); const [error, setError] = useState<string>();
  const [alternativesExhausted, setAlternativesExhausted] = useState(false);
  const [resultSignature, setResultSignature] = useState<string | undefined>(initialRoute ? routeQuerySignature(initialRoute.query) : undefined);
  const [calculationStatus, setCalculationStatus] = useState<"idle" | "running" | "timeout" | "cancelled" | "error" | "stale">("idle");
  const latest = useRef(0); const projectRef = useRef(project); const contextRef = useRef(context); const previewRef = useRef(onPreview);
  const [calculationKey, setCalculationKey] = useState<CalculationKey | undefined>(undefined);
  const querySignature = JSON.stringify({ from, to, profile, actorId: actorId || undefined, widthOverride, preferences: preferences ?? {}, scenarioId: context.scenarioId, stepId: context.stepId });
  const priorQuerySignature = useRef(querySignature);
  const routeRevision = storyRouteRevision(project);
  const resultIsCurrent = result ? isStoryRouteCurrent(project, result, routeRevision) : false;
  const currentCalculationKey: CalculationKey = { projectId: project.id, revision: routeRevision, query: querySignature, scenarioId: context.scenarioId, stepId: context.stepId, routeService };
  const keyChanged = (left: CalculationKey, right: CalculationKey) => left.projectId !== right.projectId || left.revision !== right.revision || left.query !== right.query || left.scenarioId !== right.scenarioId || left.stepId !== right.stepId || left.routeService !== right.routeService;
  useLayoutEffect(() => {
    projectRef.current = project; contextRef.current = context;
  }, [project, context, context.scenarioId, context.stepId, context.lensId]);
  useLayoutEffect(() => { previewRef.current = onPreview; }, [onPreview]);
  useLayoutEffect(() => {
    if (priorQuerySignature.current === querySignature) return;
    priorQuerySignature.current = querySignature; setAlternativesExhausted(false); setResult(undefined); setResultSignature(undefined); previewRef.current(undefined);
  }, [querySignature]);
  useLayoutEffect(() => {
    return () => { latest.current += 1; routeService?.cancel(); setCalculationStatus((previous) => previous === "running" ? "stale" : previous); };
  }, [routeService, routeRevision, querySignature, context.scenarioId, context.stepId]);
  useLayoutEffect(() => {
    if (result && (!resultIsCurrent || resultSignature !== querySignature)) previewRef.current(undefined);
  }, [querySignature, result, resultIsCurrent, resultSignature]);
  const invalidatedCalculation = calculationStatus === "running" && calculationKey !== undefined && keyChanged(calculationKey, currentCalculationKey);
  const visibleCalculationStatus = invalidatedCalculation ? "stale" : calculationStatus;
  function isStale(capturedRevision: string, capturedSignature: string) { return projectRef.current.id !== project.id || storyRouteRevision(projectRef.current) !== capturedRevision || contextRef.current.scenarioId !== context.scenarioId || contextRef.current.stepId !== context.stepId || capturedSignature !== querySignature; }
  function invalidateCurrentCalculation() {
    if (calculationStatus !== "running") return;
    routeService?.cancel(); setCalculationStatus("stale"); onPreview(undefined);
  }
  function updateEndpoint(endpoint: "from" | "to", value: StoryRouteEndpoint, optionId = endpointOptionId(endpointOptions, value), pointConfirmed = true) {
    invalidateCurrentCalculation(); (endpoint === "from" ? setFrom : setTo)(value); (endpoint === "from" ? setFromOptionId : setToOptionId)(optionId); (endpoint === "from" ? setFromPointConfirmed : setToPointConfirmed)(pointConfirmed);
  }
  async function calculate(alternativeLimit = 1) {
    const pendingWaterEndpoint = (!fromPointConfirmed && endpointOptions.find(({ id }) => id === fromOptionId)?.requiresPoint ? fromOptionId : undefined)
      ?? (!toPointConfirmed && endpointOptions.find(({ id }) => id === toOptionId)?.requiresPoint ? toOptionId : undefined);
    if (pendingWaterEndpoint) {
      setError(pl ? "Wskaż konkretny punkt na brzegu terenu wodnego albo wpisz jego współrzędne." : "Pick a concrete point on the water terrain edge or enter its coordinates.");
      return;
    }
    if (!routeService) { setCalculationStatus("error"); setError(pl ? "Brak usługi obliczania tras." : "Route calculation service is unavailable."); return; }
    const capturedRevision = routeRevision; const capturedSignature = querySignature; const attempt = ++latest.current;
    setCalculationKey(currentCalculationKey);
    try {
      const activePreferences = Object.fromEntries(Object.entries(preferences ?? {}).filter(([, value]) => value !== undefined)) as NonNullable<StoryRouteRequest["preferences"]>;
      const query: StoryRouteRequest = { from, to, profile, ...(widthOverride === undefined ? {} : { width: widthOverride }), actorId: actorId || undefined, scenarioId: context.scenarioId, stepId: context.stepId, ...(Object.keys(activePreferences).length ? { preferences: activePreferences } : {}) };
      setCalculationStatus("running"); setError(undefined);
      if (alternativeLimit === 1) { setAlternativesExhausted(false); setResult(undefined); setResultSignature(undefined); onPreview(undefined); }
      const outcome = await routeService.calculate(project, { ...query, alternativeLimit });
      if (attempt !== latest.current) return;
      if (outcome.status === "cancelled") { setCalculationStatus("cancelled"); return; }
      if (outcome.status !== "ready") { setCalculationStatus(outcome.status); setError(outcome.error); return; }
      if (isStale(capturedRevision, capturedSignature)) { setCalculationStatus("stale"); onPreview(undefined); return; }
      const planned = outcome.result!;
      if (alternativeLimit > 1 && planned.routes.length < alternativeLimit) setAlternativesExhausted(true);
      const route = { id: initialRoute?.id ?? result?.id ?? crypto.randomUUID(), name: name.trim() || (pl ? "Nowa trasa" : "New route"), query, result: planned, sourceRevision: planned.sourceRevision };
      setResult(route); setResultSignature(capturedSignature); onPreview(route); setCalculationStatus("idle");
    } catch (cause) { if (attempt === latest.current) { setCalculationStatus("error"); setError(String(cause)); onPreview(undefined); } }
  }
  function cancelCalculation() { latest.current += 1; routeService?.cancel(); setCalculationStatus("cancelled"); setResult(undefined); setResultSignature(undefined); onPreview(undefined); }
  function setPreference(key: RoutePreference, value: boolean | undefined) { invalidateCurrentCalculation(); setPreferences((current) => { const next = { ...current }; if (value === undefined) delete next[key]; else next[key] = value; return next; }); }
  function selectEndpoint(endpoint: "from" | "to", optionId: string) {
    const option = endpointOptions.find(({ id }) => id === optionId);
    if (option) {
      updateEndpoint(endpoint, endpointForOption(option), option.id, !option.requiresPoint);
      if (option.requiresPoint) requestPoint(endpoint, endpointForOption(option), option.id);
    }
  }
  function requestPoint(endpoint: "from" | "to", selectedValue?: StoryRouteEndpoint, selectedOptionId?: string) {
    const placeId = selectedValue?.placeId ?? (endpoint === "from" ? from.placeId : to.placeId);
    onOpenPlace?.(placeId); onRequestPoint?.(endpoint, (value) => {
      const selected = selectedOptionId ? endpointOptions.find(({ id }) => id === selectedOptionId) : undefined;
      updateEndpoint(endpoint, value, selected?.placeId === value.placeId ? selected.id : endpointOptionId(endpointOptions, value), true);
    });
  }
  const defaultWidth = routeWidth({ profile });
  const stale = result && (!resultIsCurrent || resultSignature !== querySignature);
  const fromOption = endpointOptions.find(({ id }) => id === fromOptionId);
  const toOption = endpointOptions.find(({ id }) => id === toOptionId);
  const pendingFromPoint = Boolean(fromOption?.requiresPoint && !fromPointConfirmed);
  const pendingToPoint = Boolean(toOption?.requiresPoint && !toPointConfirmed);
  const readyPreview = result?.result.status === "ready" && !stale ? result : undefined;
  const routeVisibleOnActivePlace = readyPreview && activePlaceId
    ? readyPreview.result.routes.some((alternative) => alternative.segments.some((segment) => storyRouteSegmentVisibleOnPlace(project, activePlaceId, segment)))
    : true;
  const startVisibleOnActivePlace = readyPreview && activePlaceId
    ? readyPreview.result.routes.some((alternative) => storyRouteEndpointVisibleOnPlace(project, activePlaceId, alternative, readyPreview.query.from))
    : true;
  const endVisibleOnActivePlace = readyPreview && activePlaceId
    ? readyPreview.result.routes.some((alternative) => storyRouteEndpointVisibleOnPlace(project, activePlaceId, alternative, readyPreview.query.to))
    : true;
  return <section className={styles.panel} aria-label={pl ? "Planowanie tras" : "Route planning"}>
    <h2>{pl ? "Trasy" : "Routes"}</h2>
    <p>{pl ? "Sprawdź, którędy wybrana postać lub grupa może dostać się z jednego miejsca do drugiego. Gabinet uwzględni geometrię, przejścia, dostęp, klucze i wybrany sposób podróży." : "Check how a selected character or group can travel from one place to another. The Cabinet accounts for geometry, passages, access, keys, and the chosen mode of travel."}</p>
    <label>{pl ? "Nazwa trasy" : "Route name"}<input value={name} onChange={(event) => setName(event.currentTarget.value)}/></label>
    {([{ endpoint: "from" as const, label: pl ? "Skąd" : "From", value: from, pending: pendingFromPoint, update: (next: StoryRouteEndpoint) => updateEndpoint("from", next, fromOptionId, true) }, { endpoint: "to" as const, label: pl ? "Dokąd" : "To", value: to, pending: pendingToPoint, update: (next: StoryRouteEndpoint) => updateEndpoint("to", next, toOptionId, true) }]).map(({ endpoint, label, value, pending, update }) => <fieldset key={label}><legend>{label}</legend>
      <select aria-label={label} value={(endpoint === "from" ? fromOptionId : toOptionId) || endpointOptionId(endpointOptions, value)} onChange={(event) => selectEndpoint(endpoint, event.currentTarget.value)}>{endpointOptions.map((option) => <option key={option.id} value={option.id}>{option.kind === "terrain" ? `${option.name} (${pl ? "teren" : "terrain"})` : option.name}</option>)}</select>
      <button type="button" className={styles.pointButton} disabled={!onRequestPoint} onClick={() => requestPoint(endpoint)}>{pl ? "Wskaż na mapie" : "Pick on map"}</button>
      {pending && <p role="alert">{pl ? "Teren wodny wymaga wskazania konkretnego punktu — najlepiej na brzegu." : "Water terrain requires a concrete point — preferably on its edge."}</p>}
      <details><summary>{pl ? "Dokładne współrzędne" : "Exact coordinates"}</summary><div className={styles.coordinates}>{(["x", "y"] as const).map((axis) => <label key={axis}>{axis.toUpperCase()} (m)<input type="number" step="any" value={value.point[axis]} onChange={(event) => update({ ...value, point: { ...value.point, [axis]: Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : 0 } })}/></label>)}</div></details>
    </fieldset>)}
    <label>{pl ? "Kto podróżuje" : "Traveller"}<select value={actorId} onChange={(event) => { invalidateCurrentCalculation(); setActorId(event.currentTarget.value); }}><option value="">{pl ? "Bez wskazanej postaci" : "No specific character"}</option>{project.story.world.filter(({ kind }) => kind !== "key").map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
    <label>{pl ? "Sposób poruszania" : "Travel mode"}<select value={profile} onChange={(event) => { invalidateCurrentCalculation(); setProfile(event.currentTarget.value as StoryRouteRequest["profile"]); }}><option value="foot">{pl ? "Pieszo" : "On foot"}</option><option value="mounted">{pl ? "Konno" : "Mounted"}</option><option value="vehicle">{pl ? "Pojazdem" : "Vehicle"}</option></select></label>
    <details className={styles.precision}><summary>{pl ? "Precyzja" : "Precision"}</summary><label className={styles.override}><input type="checkbox" checked={widthOverride !== undefined} onChange={(event) => { invalidateCurrentCalculation(); setWidthOverride(event.currentTarget.checked ? defaultWidth : undefined); }}/><span>{pl ? "Nadpisz szerokość przejścia" : "Override clear width"}</span></label>{widthOverride !== undefined ? <label>{pl ? "Szerokość przejścia (m)" : "Clear width (m)"}<input type="number" min="0.1" step="0.1" value={widthOverride} onChange={(event) => { invalidateCurrentCalculation(); setWidthOverride(Math.max(.1, Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : defaultWidth)); }}/></label> : <p>{pl ? `Domyślnie dla tego trybu: ${defaultWidth} m` : `Mode default: ${defaultWidth} m`}</p>}</details>
    <fieldset className={styles.preferences}><legend>{pl ? "Preferencje trasy" : "Route preferences"}</legend>{(["preferRoads", "allowOffroad", "allowWindows"] as const).map((key) => <label key={key}><span>{key === "preferRoads" ? pl ? "Preferuj drogi" : "Prefer roads" : key === "allowOffroad" ? pl ? "Dopuszczaj trasę poza drogą" : "Allow off-road" : pl ? "Dopuszczaj okna" : "Allow windows"}</span><select value={preferences?.[key] === undefined ? "" : String(preferences[key])} onChange={(event) => setPreference(key, event.currentTarget.value === "" ? undefined : event.currentTarget.value === "true") }><option value="">{pl ? "Domyślnie" : "Default"}</option><option value="true">{pl ? "Tak" : "Yes"}</option><option value="false">{pl ? "Nie" : "No"}</option></select></label>)}</fieldset>
    <button type="button" disabled={visibleCalculationStatus === "running" || pendingFromPoint || pendingToPoint} onClick={() => void calculate()}>{visibleCalculationStatus === "running" ? pl ? "Obliczanie…" : "Calculating…" : pl ? "Wyznacz trasę" : "Find route"}</button>
    {visibleCalculationStatus === "running" && <button type="button" onClick={cancelCalculation}>{pl ? "Anuluj obliczanie" : "Cancel calculation"}</button>}
    {visibleCalculationStatus === "timeout" && <p role="alert">{pl ? "Obliczanie trasy trwało zbyt długo i zostało przerwane." : "The route calculation took too long and was stopped."}</p>}
    {visibleCalculationStatus === "cancelled" && <p role="status">{pl ? "Obliczanie trasy anulowano." : "Route calculation cancelled."}</p>}
    {visibleCalculationStatus === "stale" && <p role="status">{pl ? "Plan lub zapytanie zmieniły się podczas obliczania. Uruchom obliczanie ponownie." : "The plan or query changed during calculation. Run it again."}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div role="status" className={styles.result}><strong>{stale ? pl ? "Plan się zmienił — przelicz trasę." : "The plan changed — recalculate." : result.result.status === "ready" ? pl ? "Najlepsza znaleziona trasa" : "Best route found" : result.result.status === "unknown" ? pl ? "Brakuje danych do potwierdzenia trasy" : "Missing facts prevent verification" : pl ? "Nie znaleziono dostępnej trasy" : "No accessible route found"}</strong>
      {readyPreview && activePlaceId && (!routeVisibleOnActivePlace || !startVisibleOnActivePlace || !endVisibleOnActivePlace) && <div className={styles.routeNavigation}>{!routeVisibleOnActivePlace && <p>{pl ? "Żaden odcinek tej trasy nie jest widoczny na bieżącym arkuszu." : "No segment of this route is visible on the current sheet."}</p>}<div>{!startVisibleOnActivePlace && <button type="button" onClick={() => onOpenPlace?.(readyPreview.query.from.placeId)}>{pl ? "Pokaż początek trasy" : "Show route start"}</button>}{!endVisibleOnActivePlace && <button type="button" onClick={() => onOpenPlace?.(readyPreview.query.to.placeId)}>{pl ? "Pokaż koniec trasy" : "Show route end"}</button>}</div></div>}
      {result.result.routes.map((route, index) => <details key={route.id}><summary>{index + 1}. {route.distance.toFixed(1)} m</summary>{result.result.status === "ready" && <p className={styles.routeSummary} data-route-summary="true">{routePlaceName(project, result.query.from.placeId)} → {routePlaceName(project, result.query.to.placeId)} · {route.distance.toFixed(1)} m · {routeSheetLabel(pl, new Set(route.segments.map(({ placeId }) => placeId)).size)}</p>}{route.conditions.map((condition) => <p key={condition}>{diagnosticFormatter.format(condition)}</p>)}{[...new Set(route.segments.map(({ placeId }) => placeId))].map((id) => <button key={id} type="button" onClick={() => onOpenPlace?.(id)}>{project.places.find((place) => place.id === id)?.name ?? id}</button>)}</details>)}
      {[...result.result.missingFacts, ...result.result.reasons].map((reason) => <p key={reason}>{diagnosticFormatter.format(reason)}</p>)}
      {result.result.status === "ready" && !stale && !alternativesExhausted && result.result.routes.length < 3 && <button type="button" disabled={visibleCalculationStatus === "running"} onClick={() => void calculate(result.result.routes.length + 1)}>{pl ? "Wyznacz inną trasę" : "Find another route"}</button>}
      <button type="button" disabled={Boolean(stale)} onClick={() => onSave({ ...result, name: name.trim() || result.name })}>{pl ? "Zachowaj trasę" : "Save route"}</button>
      <button type="button" onClick={() => { setResult(undefined); setResultSignature(undefined); onPreview(undefined); }}>{pl ? "Ukryj podgląd" : "Hide preview"}</button>
    </div>}
    {initialRoute && onDelete && <button type="button" onClick={() => onDelete(initialRoute.id)}>{pl ? "Usuń zapisaną trasę" : "Delete saved route"}</button>}
  </section>;
}
