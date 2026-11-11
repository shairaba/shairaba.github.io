/* Shared chrome for every tool: the six-slot tool switcher.
   - Pages built on the kit have <nav data-k-team="ev"> in their band: filled here.
   - Older tools (adapter mode) load this from their app.js with data-tool="…";
     the home link and switcher are inserted at the start of their .topbar. */
(function () {
  var TOOLS = [
    ['teamlist', 'Teamlists', 'vgc-teamlist-generator/index.html', 'VGC Teamlist Generator'],
    ['ev', 'EVs', 'ev-converter/index.html', 'EV Converter'],
    ['print', 'Print', 'PokemonTeamListCreator-ChampionsBeta/index.html', 'TeamlistCreator, printable team lists'],
    ['events', 'Events', 'pokemon-events-italia/index.html', 'Event Locator'],
    ['locals', 'Locals', 'vgc-locals-italia/index.html', 'VGC Locals Italia'],
    ['cp', 'CP', 'cp-tracker/index.html', 'CP Tracker']
  ];
  var script = document.currentScript;
  var base = script.src.replace(/kit\/kit\.js.*$/, '');

  function links(here) {
    return TOOLS.map(function (t) {
      return '<a href="' + base + t[2] + '" title="' + t[3] + '"' + (t[0] === here ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
    }).join('');
  }

  function run() {
    var navs = document.querySelectorAll('[data-k-team]');
    navs.forEach(function (nav) { nav.innerHTML = links(nav.getAttribute('data-k-team')); });
    document.querySelectorAll('[data-k-home]').forEach(function (a) { a.href = base + 'index.html'; });

    var tool = script.getAttribute('data-tool');
    var bar = document.querySelector('.topbar');
    if (!navs.length && tool && bar && !bar.querySelector('.k-team')) {
      var home = document.createElement('a');
      home.className = 'k-home'; home.href = base + 'index.html'; home.textContent = 'VGC tools';
      var nav = document.createElement('nav');
      nav.className = 'k-team'; nav.setAttribute('aria-label', 'Tools'); nav.innerHTML = links(tool);
      bar.insertBefore(nav, bar.firstChild);
      bar.insertBefore(home, nav);
    }
  }
  function showCurrent() {
    document.querySelectorAll('.k-team').forEach(function (nav) {
      var cur = nav.querySelector('[aria-current="page"]');
      if (!cur || nav.scrollWidth <= nav.clientWidth) return;
      var n = nav.getBoundingClientRect(), c = cur.getBoundingClientRect();
      nav.scrollLeft += (c.left + c.width / 2) - (n.left + n.width / 2);
    });
  }
  var _run = run;
  run = function () { _run(); showCurrent(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
