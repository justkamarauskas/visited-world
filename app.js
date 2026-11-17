const STORAGE_KEY = "visited-countries.v1";

const DISPLAY_NAMES = {
  "Antigua and Barb.": "Antigua and Barbuda",
  "Ashmore and Cartier Is.": "Ashmore and Cartier Islands",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Br. Indian Ocean Ter.": "British Indian Ocean Territory",
  "British Virgin Is.": "British Virgin Islands",
  "Cayman Is.": "Cayman Islands",
  "Central African Rep.": "Central African Republic",
  "Cook Is.": "Cook Islands",
  "Dem. Rep. Congo": "Democratic Republic of the Congo",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "Faeroe Is.": "Faroe Islands",
  "Falkland Is.": "Falkland Islands",
  "Fr. Polynesia": "French Polynesia",
  "Fr. S. Antarctic Lands": "French Southern and Antarctic Lands",
  "Heard I. and McDonald Is.": "Heard Island and McDonald Islands",
  "Indian Ocean Ter.": "Indian Ocean Territories",
  "Marshall Is.": "Marshall Islands",
  "N. Cyprus": "Northern Cyprus",
  "N. Mariana Is.": "Northern Mariana Islands",
  "Pitcairn Is.": "Pitcairn Islands",
  "S. Geo. and the Is.": "South Georgia and the South Sandwich Islands",
  "S. Sudan": "South Sudan",
  "Solomon Is.": "Solomon Islands",
  "St. Kitts and Nevis": "Saint Kitts and Nevis",
  "St. Pierre and Miquelon": "Saint Pierre and Miquelon",
  "St. Vin. and Gren.": "Saint Vincent and the Grenadines",
  "St-Barthélemy": "Saint Barthélemy",
  "St-Martin": "Saint Martin",
  "Turks and Caicos Is.": "Turks and Caicos Islands",
  "U.S. Virgin Is.": "U.S. Virgin Islands",
  "W. Sahara": "Western Sahara",
  "Macedonia": "North Macedonia",
  "eSwatini": "Eswatini",
  "Congo": "Republic of the Congo",
};

const ALIASES = {
  "United States of America": "usa america united states",
  "United Kingdom": "uk britain england scotland wales",
  "United Arab Emirates": "uae emirates",
  "Czechia": "czech republic",
  "Myanmar": "burma",
  "Cabo Verde": "cape verde",
  "Côte d'Ivoire": "cote divoire ivory coast",
  "eSwatini": "swaziland",
  "Macedonia": "north macedonia",
  "Dem. Rep. Congo": "drc dr congo",
  "Congo": "republic of the congo",
  "S. Sudan": "south sudan",
  "N. Cyprus": "northern cyprus",
  "W. Sahara": "western sahara",
  "Dominican Rep.": "dominican republic",
  "Central African Rep.": "central african republic",
  "Bosnia and Herz.": "bosnia herzegovina",
  "Eq. Guinea": "equatorial guinea",
  "St. Vin. and Gren.": "saint vincent grenadines",
  "Antigua and Barb.": "antigua barbuda",
};

const statusEl = document.querySelector("#status");
function formatPercent(value) {
  if (!(value > 0)) return "0%";
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}
const searchInput = document.querySelector("#search");
const listEl = document.querySelector("#list");
const emptyEl = document.querySelector("#empty");
const shownEl = document.querySelector("#shown");
const saveNote = document.querySelector("#save-note");
const clearButton = document.querySelector("#clear");
const modeAll = document.querySelector("#mode-all");
const modeVisited = document.querySelector("#mode-visited");
const svgEl = document.querySelector("#map");

let mode = "all";
let hotKey = null;
let currentScale = 1;
let canSave = true;

function labelFor(key) {
  return DISPLAY_NAMES[key] || key;
}

function loadVisited() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item) => typeof item === "string"));
  } catch (error) {
    canSave = false;
    return new Set();
  }
}

function saveVisited(visited) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]));
    canSave = true;
  } catch (error) {
    canSave = false;
  }
  saveNote.hidden = canSave;
}

function showStatus(text) {
  statusEl.textContent = text || "Scroll to zoom. Drag to move the map.";
}

function boot() {
  if (!window.d3 || !window.topojson || !window.WORLD) {
    showStatus("The map files did not load. Keep this folder together and open index.html again.");
    return;
  }

  const width = 960;
  const height = 520;
  const projection = d3.geoNaturalEarth1().fitExtent(
    [[8, 8], [width - 8, height - 8]],
    { type: "Sphere" }
  );
  const path = d3.geoPath(projection);
  const features = topojson.feature(window.WORLD, window.WORLD.objects.countries).features;

  features.forEach((feature) => {
    feature.key = feature.properties.name;
    feature.label = labelFor(feature.key);
    feature.search = [feature.label, feature.key, ALIASES[feature.key] || ""].join(" ").toLowerCase();
    feature.area = d3.geoArea(feature);
  });
  const landTotal = features.reduce((sum, feature) => sum + feature.area, 0);
  features.sort((a, b) => a.label.localeCompare(b.label, "en"));

  const byKey = new Map(features.map((feature) => [feature.key, feature]));
  const visited = loadVisited();
  let changed = false;
  for (const key of [...visited]) {
    if (!byKey.has(key)) {
      visited.delete(key);
      changed = true;
    }
  }
  if (changed) saveVisited(visited);

  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${width} ${height}`);
  const zoomLayer = svg.append("g");
  zoomLayer.append("path").datum({ type: "Sphere" }).attr("class", "ocean").attr("d", path);
  zoomLayer.append("path").datum(d3.geoGraticule10()).attr("class", "graticule").attr("d", path);

  function pointOf(feature) {
    const projected = projection(d3.geoCentroid(feature));
    if (!projected || !Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) return null;
    return projected;
  }

  const countryPaths = new Map();
  zoomLayer.append("g")
    .selectAll("path")
    .data(features)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .each(function addTitle(feature) {
      countryPaths.set(feature.key, this);
      d3.select(this).append("title").text(feature.label);
    })
    .on("click", (event, feature) => {
      if (event.defaultPrevented) return;
      toggle(feature.key);
    })
    .on("mouseenter", (event, feature) => highlight(feature.key))
    .on("mouseleave", () => highlight(null));

  zoomLayer.append("path")
    .datum(topojson.mesh(window.WORLD, window.WORLD.objects.countries, (a, b) => a !== b))
    .attr("class", "borders")
    .attr("d", path);

  const dots = new Map();
  const tinyFeatures = features.filter((feature) => path.area(feature) < 2 && pointOf(feature));
  const dotsLayer = zoomLayer.append("g");
  dotsLayer.selectAll("circle")
    .data(tinyFeatures)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", (feature) => pointOf(feature)[0])
    .attr("cy", (feature) => pointOf(feature)[1])
    .each(function rememberDot(feature) {
      dots.set(feature.key, this);
      d3.select(this).append("title").text(feature.label);
    })
    .on("click", (event, feature) => {
      if (event.defaultPrevented) return;
      toggle(feature.key);
    })
    .on("mouseenter", (event, feature) => highlight(feature.key))
    .on("mouseleave", () => highlight(null));

  function resizeDots() {
    dotsLayer.selectAll("circle").attr("r", 4.5 / currentScale);
  }

  function paint(key) {
    const on = visited.has(key);
    const element = countryPaths.get(key);
    if (element) element.classList.toggle("visited", on);
    const dot = dots.get(key);
    if (dot) dot.classList.toggle("visited", on);
  }

  function paintAll() {
    for (const key of countryPaths.keys()) paint(key);
  }

  function highlight(key) {
    if (hotKey) {
      const previous = countryPaths.get(hotKey);
      if (previous) previous.classList.remove("is-hot");
      const previousDot = dots.get(hotKey);
      if (previousDot) previousDot.classList.remove("is-hot");
    }
    hotKey = key;
    if (!key || !byKey.has(key)) {
      showStatus("");
      return;
    }
    const element = countryPaths.get(key);
    element.classList.add("is-hot");
    element.parentNode.appendChild(element);
    const dot = dots.get(key);
    if (dot) {
      dot.classList.add("is-hot");
      dot.parentNode.appendChild(dot);
    }
    showStatus(byKey.get(key).label);
  }

  function visitedCount() {
    let count = 0;
    for (const feature of features) {
      if (visited.has(feature.key)) count += 1;
    }
    return count;
  }

  function renderCount() {
    const count = visitedCount();
    let visitedLand = 0;
    for (const feature of features) {
      if (visited.has(feature.key)) visitedLand += feature.area;
    }
    const countryPct = features.length ? (count / features.length) * 100 : 0;
    const landPct = landTotal ? (visitedLand / landTotal) * 100 : 0;
    const countryText = formatPercent(countryPct);
    const landText = formatPercent(landPct);
    document.querySelector("#total-pct").textContent = countryText;
    document.querySelector("#count").textContent = String(count);
    document.querySelector("#total").textContent = String(features.length);
    document.querySelector("#land-pct").textContent = landText;
    document.querySelector("#bar").style.width = `${countryPct}%`;
    clearButton.disabled = count === 0;
  }

  function visibleFeatures() {
    const query = searchInput.value.trim().toLowerCase();
    return features.filter((feature) => {
      if (mode === "visited" && !visited.has(feature.key)) return false;
      if (!query) return true;
      return feature.search.includes(query);
    });
  }

  function renderList() {
    const rows = visibleFeatures();
    const noun = rows.length === 1 ? "place" : "places";
    shownEl.textContent = `${rows.length} ${noun}`;
    listEl.replaceChildren();
    if (!rows.length) {
      emptyEl.hidden = false;
      emptyEl.textContent = mode === "visited" && !searchInput.value.trim()
        ? "No countries marked yet."
        : "No countries match that search.";
      return;
    }
    emptyEl.hidden = true;
    const fragment = document.createDocumentFragment();
    for (const feature of rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = visited.has(feature.key) ? "place is-on" : "place";
      button.dataset.key = feature.key;
      button.setAttribute("aria-pressed", visited.has(feature.key) ? "true" : "false");

      const mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "place-name";
      name.textContent = feature.label;
      button.append(mark, name);
      button.addEventListener("click", () => toggle(feature.key));
      button.addEventListener("mouseenter", () => highlight(feature.key));
      button.addEventListener("mouseleave", () => highlight(null));
      button.addEventListener("focus", () => highlight(feature.key));
      button.addEventListener("blur", () => highlight(null));
      fragment.append(button);
    }
    listEl.append(fragment);
  }

  function toggle(key) {
    if (!byKey.has(key)) return;
    if (visited.has(key)) visited.delete(key);
    else visited.add(key);
    saveVisited(visited);
    paint(key);
    renderCount();
    renderList();
    for (const button of listEl.querySelectorAll(".place")) {
      if (button.dataset.key === key) {
        button.scrollIntoView({ block: "nearest" });
        break;
      }
    }
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 16])
    .on("zoom", (event) => {
      currentScale = event.transform.k;
      zoomLayer.attr("transform", event.transform);
      resizeDots();
    });

  svg.call(zoom);
  svg.on("dblclick.zoom", null);

  document.querySelector("#reset").addEventListener("click", () => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400;
    svg.transition().duration(duration).call(zoom.transform, d3.zoomIdentity);
  });

  searchInput.addEventListener("input", renderList);

  function setMode(next) {
    mode = next;
    const allOn = next === "all";
    modeAll.classList.toggle("is-on", allOn);
    modeVisited.classList.toggle("is-on", !allOn);
    modeAll.setAttribute("aria-pressed", allOn ? "true" : "false");
    modeVisited.setAttribute("aria-pressed", allOn ? "false" : "true");
    renderList();
  }

  modeAll.addEventListener("click", () => setMode("all"));
  modeVisited.addEventListener("click", () => setMode("visited"));

  clearButton.addEventListener("click", () => {
    const count = visitedCount();
    if (!count) return;
    const noun = count === 1 ? "country" : "countries";
    if (!window.confirm(`Clear ${count} visited ${noun}?`)) return;
    visited.clear();
    saveVisited(visited);
    paintAll();
    highlight(null);
    renderCount();
    renderList();
  });

  resizeDots();
  paintAll();
  renderCount();
  renderList();
  saveNote.hidden = canSave;
}

boot();
