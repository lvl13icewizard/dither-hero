// Live tuning panel for the dither engine. Design-phase scaffolding: nobody
// can specify grain or emitter position in the abstract — you have to see
// them against the real art. Hand this over, let the values get chosen in one
// sitting, then paste the copied JSON into code and delete the panel.
//
//   <Picker engine={engine} />
//
// `extra` adds project-specific groups without forking this:
//   <Picker engine={engine} extra={[
//     { label: "masthead", options: { serif: {}, mono: {} },
//       onPick: (key) => setMasthead(key) },
//   ]} />

import { useEffect, useState, useRef } from "react";
import "./picker.css";

// [key, min, max, step, hint]
const GROUPS = {
  frame: [
    ["zoom", 1, 3.5, 0.01, "in / out"],
    ["panX", 0, 1, 0.01, "left ↔ right"],
    ["panY", 0, 1, 0.01, "up ↕ down"],
  ],
  dots: [
    ["grain", 3, 24, 1, "cell size — bigger = chunkier"],
    ["toneSteps", 2, 6, 1, "shades of dot"],
    ["dotGap", 0.15, 0.6, 0.01, "space around each dot"],
    ["dotFill", 0.5, 1, 0.02, "dot size in its cell"],
  ],
  tone: [
    ["contrast", -20, 80, 1, ""],
    ["shadowLift", 0, 0.8, 0.02, "0 = linear, more = brighter darks"],
    ["blackCutoff", 0, 0.15, 0.005, "below this, nothing draws"],
  ],
  particles: [
    ["particleCount", 0, 600, 10, ""],
    ["particleSpeed", 0, 0.8, 0.01, ""],
    ["emitX", 0, 1, 0.01, "source ← →, in image coords"],
    ["emitY", 0, 1, 0.01, "source ↑ ↓, in image coords"],
    ["spread", 0.02, 0.5, 0.01, "radial: ring size"],
    ["areaWidth", 0.01, 1, 0.01, "fall: box width"],
    ["areaHeight", 0.01, 1, 0.01, "fall: box height"],
    ["trailLength", 0, 6, 0.1, "fall: streak behind"],
    ["dimmest", 0, 0.6, 0.01, ""],
    ["brightest", 0, 0.9, 0.01, ""],
  ],
};
const COPY_KEYS = [
  "grain", "toneSteps", "dotGap", "dotFill", "contrast", "brightness",
  "shadowLift", "blackCutoff", "zoom", "panX", "panY", "fit", "particles",
  "emitX", "emitY", "spread", "areaWidth", "areaHeight", "particleCount",
  "particleSpeed", "trailLength", "dimmest", "brightest",
];

function Chips({ label, options, current, onPick }) {
  return (
    <>
      <h3 className="pk-h">{label}</h3>
      <div className="pk-chips">
        {options.map((o) => (
          <button key={o} className={"pk-chip" + (current === o ? " is-on" : "")}
                  onClick={() => onPick(o)}>{o}</button>
        ))}
      </div>
    </>
  );
}

export default function Picker({ engine, extra = [], slotNamespace = "dither" }) {
  const [open, setOpen] = useState(true);
  const [, force] = useState(0);
  const [note, setNote] = useState("");
  const sel = useRef({});

  useEffect(() => {
    const onKey = (e) => { if (e.key === "`") { e.preventDefault(); setOpen((v) => !v); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!engine) return null;
  const o = engine.o;
  const set = (patch) => { engine.setOptions(patch); force((n) => n + 1); };
  const snapshot = () => Object.fromEntries(COPY_KEYS.map((k) => [k, o[k]]));

  // Slots persist per namespace so switching source images keeps its own set.
  const slotKey = (n) => `dither:${slotNamespace}:${n}`;
  const save = (n) => { localStorage.setItem(slotKey(n), JSON.stringify(snapshot()));
                        setNote(`saved ${n}`); };
  const loadSlot = (n) => {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return setNote(`slot ${n} empty`);
    set(JSON.parse(raw)); setNote(`loaded ${n}`);
  };
  const copy = () => {
    const t = JSON.stringify(snapshot(), null, 2);
    setNote(t);
    navigator.clipboard?.writeText(t).catch(() => {});
  };

  if (!open) return <button className="pk-tab" onClick={() => setOpen(true)}>▸</button>;

  return (
    <aside className="pk">
      <div className="pk-row pk-head">
        <span>dither</span>
        <button className="pk-x" onClick={() => setOpen(false)} aria-label="hide panel">◂</button>
      </div>

      <Chips label="fit" options={["cover", "contain"]} current={o.fit}
             onPick={(v) => set({ fit: v })} />
      <Chips label="particles" options={["off", "fall", "radial"]} current={o.particles}
             onPick={(v) => set({ particles: v })} />

      {Object.entries(GROUPS).map(([name, defs]) => (
        <div key={name}>
          <h3 className="pk-h">{name}</h3>
          {defs.map(([key, min, max, step, hint]) => (
            <div className="pk-grp" key={key}>
              <div className="pk-lbl">
                <span>{key}{hint && <i>{hint}</i>}</span>
                <b>{Math.round(o[key] * 1000) / 1000}</b>
              </div>
              <input type="range" min={min} max={max} step={step} value={o[key]}
                     onChange={(e) => set({ [key]: +e.target.value })} />
            </div>
          ))}
        </div>
      ))}

      {extra.map((g) => (
        <Chips key={g.label} label={g.label} options={Object.keys(g.options)}
               current={sel.current[g.label]}
               onPick={(k) => {
                 sel.current[g.label] = k;
                 if (g.onPick) g.onPick(k); else set(g.options[k]);
               }} />
      ))}

      <h3 className="pk-h">slots</h3>
      <div className="pk-chips">
        <span className="pk-mini">save</span>
        {[1, 2, 3].map((n) => (
          <button key={n} className="pk-chip" onClick={() => save(n)}>{n}</button>
        ))}
      </div>
      <div className="pk-chips">
        <span className="pk-mini">load</span>
        {[1, 2, 3].map((n) => (
          <button key={n} className="pk-chip" onClick={() => loadSlot(n)}>{n}</button>
        ))}
      </div>
      <div className="pk-chips pk-actions">
        <button className="pk-chip" onClick={copy}>copy settings</button>
      </div>
      {note && <pre className="pk-out">{note}</pre>}
      <p className="pk-hint">` toggles the panel</p>
    </aside>
  );
}
