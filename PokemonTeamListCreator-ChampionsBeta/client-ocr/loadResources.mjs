// Dynamically loads the per-language Resources/*.js files this pipeline
// needs (they define plain globals like `var pokesFre = {...}`, not ES
// modules, matching the convention script.js already uses for
// Showdown/pokedex.js and Showdown/natures.js) and hands back the parsed
// objects directly - no globals leak into the page beyond what the
// Resources files themselves define.
const FOLDER = { name: "Pokes", item: "Items", ability: "Abilities", move: "Moves" };
const VAR_PREFIX = { name: "pokes", item: "items", ability: "abilities", move: "moves" };
const SUFFIX = { en: "En", fr: "Fre", de: "Ger", it: "Ita", es: "Es", ja: "Jpn", ko: "Kor", "zh-Hans": "Chs", "zh-Hant": "Cht" };

const scriptCache = new Map();

function loadScriptOnce(src) {
  if (scriptCache.has(src)) return scriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
  scriptCache.set(src, promise);
  return promise;
}

// resourcesBaseUrl: e.g. "./Resources" (relative to the page loading this).
// langs: language codes actually needed (the selected screenshot language
// plus 'en', since translation output is always English).
export async function loadResourceBundle(resourcesBaseUrl, langs) {
  const allLangs = [...new Set(["en", ...langs])];
  const bundle = { name: {}, item: {}, ability: {}, move: {} };

  const loads = [];
  for (const [category, folder] of Object.entries(FOLDER)) {
    for (const lang of allLangs) {
      const suffix = SUFFIX[lang];
      const varName = `${VAR_PREFIX[category]}${suffix}`;
      const src = `${resourcesBaseUrl}/${folder}/${folder}${suffix}.js`;
      loads.push(
        loadScriptOnce(src).then(() => {
          bundle[category][lang] = window[varName];
        })
      );
    }
  }
  await Promise.all(loads);
  return bundle;
}

// The Showdown-style base-stat dex (Resources/Showdown/pokedex.js,
// `var pokedex = {...}`) - loaded the same way, once, independent of
// language.
export async function loadPokedex(resourcesBaseUrl) {
  await loadScriptOnce(`${resourcesBaseUrl}/Showdown/pokedex.js`);
  return window.pokedex;
}
