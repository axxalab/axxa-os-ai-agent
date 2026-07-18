// storybook/main.tsx
// Shell do storybook: nav de stories + controles de tema (light/dark),
// densidade (compact/normal/large) e viewport (mobile/desktop).
// A story renderiza dentro de um frame com a MESMA árvore de classes do
// plugin real: .axxa-root[data-axxa-density] dentro do body theme-*.

import "./obsidian-shim"; // aplica polyfills de DOM antes de qualquer componente
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppContext } from "../src/components/_shared/AppContext";
import { ErrorBoundary } from "../src/components/_shared/ErrorBoundary";
import { TranslationsContext, getTranslations } from "../src/i18n";
import { registerBrandIcons } from "../src/components/_shared/brandIcons";
import { registerBrandLogos } from "../src/components/_shared/brandLogos";
import { STORIES } from "./stories";
import { mockApp } from "./mock";

registerBrandIcons();
registerBrandLogos();

function useHashState(key: string, initial: string): [string, (v: string) => void] {
  const read = () => {
    const params = new URLSearchParams(location.hash.slice(1));
    return params.get(key) ?? initial;
  };
  const [value, setValue] = useState(read);
  // Sincroniza com mudanças externas do hash (navegação programática/capture).
  useEffect(() => {
    const onHash = () => setValue(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const set = (v: string) => {
    const params = new URLSearchParams(location.hash.slice(1));
    params.set(key, v);
    location.hash = params.toString();
    setValue(v);
  };
  return [value, set];
}

function Shell() {
  const [storyId, setStoryId] = useHashState("story", STORIES[0].id);
  const [theme, setTheme] = useHashState("theme", "dark");
  const [density, setDensity] = useHashState("density", "normal");
  const [viewport, setViewport] = useHashState("vp", "mobile");

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme !== "dark");
  }, [theme]);

  const story = useMemo(
    () => STORIES.find((s) => s.id === storyId) ?? STORIES[0],
    [storyId]
  );
  const groups = useMemo(() => {
    const map = new Map<string, typeof STORIES>();
    for (const s of STORIES) {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group)!.push(s);
    }
    return [...map.entries()];
  }, []);

  const t = getTranslations("en-us");

  return (
    <div className="sb-shell">
      <nav className="sb-nav">
        <h1>AXXA Storybook</h1>
        {groups.map(([group, stories]) => (
          <div key={group}>
            <div className="sb-nav-group">{group}</div>
            {stories.map((s) => (
              <button
                key={s.id}
                className={s.id === story.id ? "active" : ""}
                onClick={() => setStoryId(s.id)}
              >
                {s.title}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sb-stage-wrap">
        <div className="sb-toolbar">
          <span>Tema</span>
          <select value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}>
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
          <span>Densidade</span>
          <select value={density} onChange={(e) => setDensity((e.target as HTMLSelectElement).value)}>
            <option value="compact">compact</option>
            <option value="normal">normal</option>
            <option value="large">large</option>
          </select>
          <span>Viewport</span>
          <select value={viewport} onChange={(e) => setViewport((e.target as HTMLSelectElement).value)}>
            <option value="mobile">mobile (390×844)</option>
            <option value="desktop">desktop (900)</option>
          </select>
        </div>
        <div className="sb-stage">
          <div className={`sb-frame ${viewport}`}>
            <AppContext.Provider value={mockApp}>
              <TranslationsContext.Provider value={t}>
                <div className="axxa-root" data-axxa-density={density}>
                  <ErrorBoundary>
                    {/* key força remount ao trocar story/densidade */}
                    <StoryHost key={`${story.id}-${density}`} render={story.render} />
                  </ErrorBoundary>
                </div>
              </TranslationsContext.Provider>
            </AppContext.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryHost({ render }: { render: () => unknown }) {
  return <>{render()}</>;
}

const rootEl = document.getElementById("sb-root")!;
createRoot(rootEl).render(<Shell />);
