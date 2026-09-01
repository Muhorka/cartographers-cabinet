import type { MapAppearance } from "../model/project-model";

export function AppearanceFields({ appearance, defaultColor, colorLabel, opacityLabel, resetLabel, onChange, onReset }: {
  appearance?: MapAppearance;
  defaultColor: string;
  colorLabel: string;
  opacityLabel: string;
  resetLabel?: string;
  onChange(appearance: MapAppearance): void;
  onReset?(): void;
}) {
  const fillColor = appearance?.fillColor ?? defaultColor;
  const fillOpacity = appearance?.fillOpacity ?? .55;
  const commitOpacity = (value: string) => {
    const next = Number(value);
    if (Number.isFinite(next) && next >= 0 && next <= 1 && next !== fillOpacity) onChange({ ...appearance, fillColor, fillOpacity: next });
  };
  return <>
    <label><span>{colorLabel}</span><input type="color" value={fillColor} onInput={(event) => onChange({ ...appearance, fillColor: event.currentTarget.value, fillOpacity })}/></label>
    <label><span>{opacityLabel}</span><input type="range" min="0" max="1" step="0.05" defaultValue={fillOpacity} onPointerUp={(event) => commitOpacity(event.currentTarget.value)} onKeyUp={(event) => commitOpacity(event.currentTarget.value)}/></label>
    {onReset && resetLabel && <button type="button" onClick={onReset}>{resetLabel}</button>}
  </>;
}
