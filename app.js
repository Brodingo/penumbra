const state = {
  data: null,
  category: "areas",
  search: "",
  minLevel: 0,
  maxLevel: 150,
  guildClass: "",
  sortKey: "level",
  sortDirection: "asc",
};

const elements = {
  tabs: [...document.querySelectorAll(".category-tab")],
  sortHeaders: [...document.querySelectorAll("[data-sort]")],
  search: document.querySelector("#search"),
  minLevel: document.querySelector("#level-min"),
  maxLevel: document.querySelector("#level-max"),
  levelReadout: document.querySelector("#level-readout"),
  classFilter: document.querySelector("#class-filter"),
  clear: document.querySelector("#clear-filters"),
  title: document.querySelector("#results-title"),
  resultCount: document.querySelector("#result-count"),
  entryList: document.querySelector("#entry-list"),
  emptyState: document.querySelector("#empty-state"),
  loadError: document.querySelector("#load-error"),
  copyStatus: document.querySelector("#copy-status"),
};

const categoryLabels = {
  all: "All entries",
  guild_masters: "Guild masters",
  areas: "Areas",
  mobs: "Mobs & NPCs",
};

let copyStatusTimeout;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function categorizedLocations(category, label) {
  let currentLocation = "";
  const locations = new Map();
  for (const [index, entry] of (state.data[category] ?? []).entries()) {
    const isRouteHeading = entry.name && (
      /^\*+\s*from\b/i.test(entry.name)
      || /^from piercer$/i.test(entry.name)
      || /^wait to be taken out\b/i.test(entry.name)
      || /^can also$/i.test(entry.name)
      || /^hints for area$/i.test(entry.name)
      || /^with caution\b/i.test(entry.name)
      || /^known equipment in area:?$/i.test(entry.name)
      || /^(?:painted cape|acid boxers)\b/i.test(entry.name)
    );
    if (entry.name && !isRouteHeading) currentLocation = entry.name;
    const groupName = isRouteHeading
      ? currentLocation || "Additional directions"
      : entry.name ?? currentLocation ?? "Additional directions";
    const isContinuation = !entry.name || isRouteHeading;
    const normalized = {
      ...entry,
      category: label,
      groupName,
      sourceOrder: index,
    };
    const existing = locations.get(groupName);

    if (!existing) {
      locations.set(groupName, {
        ...normalized,
        displayName: isContinuation
          ? "Additional directions"
          : entry.name.replace(/^([a-z])/, (letter) => letter.toLocaleUpperCase()),
        isPlaceholder: isContinuation,
        additionalEntries: [],
      });
    } else if (!isContinuation && existing.isPlaceholder) {
      locations.set(groupName, {
        ...normalized,
        displayName: entry.name.replace(/^([a-z])/, (letter) => letter.toLocaleUpperCase()),
        isPlaceholder: false,
        additionalEntries: [
          { ...existing, additionalEntries: [] },
          ...existing.additionalEntries,
        ],
      });
    } else {
      existing.additionalEntries.push(normalized);
    }

    const location = locations.get(groupName);
    if (Number.isFinite(entry.min)) {
      location.min = Number.isFinite(location.min) ? Math.min(location.min, entry.min) : entry.min;
    }
    if (entry.max === null || (Number.isFinite(entry.max)
      && (location.max == null || entry.max > location.max))) {
      location.max = entry.max;
    }
    if (/^from piercer$/i.test(entry.name ?? "")) currentLocation = "Dragon Cult";
  }
  return [...locations.values()];
}

function getEntries() {
  if (!state.data) return [];

  const entries = [];
  if (state.category === "all" || state.category === "guild_masters") {
    for (const guild of state.data.guild_masters ?? []) {
      if (state.guildClass && guild.name !== state.guildClass) continue;
      for (const entry of guild.entries ?? []) {
        entries.push({ ...entry, category: "Guild master", groupName: guild.name });
      }
    }
  }
  if (!state.guildClass || state.category !== "all") {
    if (state.category === "all" || state.category === "areas") {
      entries.push(...categorizedLocations("areas", "Area"));
    }
    if (state.category === "all" || state.category === "mobs") {
      entries.push(...categorizedLocations("mobs", "Mob / NPC"));
    }
  }
  if (state.category === "all" && !state.guildClass) {
    for (const entry of state.data.guild_master_notes ?? []) {
      entries.push({ ...entry, category: "Guild master note", groupName: entry.name ?? "Guild master note" });
    }
  }

  const query = state.search.trim().toLocaleLowerCase();
  return entries.map((entry, archiveOrder) => ({ ...entry, archiveOrder })).filter((entry) => {
    const levelKnown = Number.isFinite(entry.min) || Number.isFinite(entry.max);
    const inLevelRange = !levelKnown
      || ((entry.max == null || entry.max >= state.minLevel)
        && (entry.min == null || entry.min <= state.maxLevel));
    const searchable = [
      entry.name,
      entry.groupName,
      entry.category,
      entry.details,
      ...(entry.routes ?? []).flat(),
      ...(entry.additionalEntries ?? []).flatMap((alternate) => [
        alternate.name,
        alternate.details,
        ...(alternate.routes ?? []).flat(),
      ]),
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return inLevelRange && (!query || searchable.includes(query));
  }).sort((left, right) => {
    let comparison = 0;
    if (state.sortKey === "location") {
      comparison = (left.displayName ?? left.name ?? left.groupName ?? "")
        .localeCompare(right.displayName ?? right.name ?? right.groupName ?? "");
    } else if (state.sortKey === "type") {
      comparison = left.category.localeCompare(right.category);
    } else {
      const leftKnown = Number.isFinite(left.min) || Number.isFinite(left.max);
      const rightKnown = Number.isFinite(right.min) || Number.isFinite(right.max);
      if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
      const leftLevel = Number.isFinite(left.min) ? left.min : left.max;
      const rightLevel = Number.isFinite(right.min) ? right.min : right.max;
      comparison = leftLevel - rightLevel;
      if (comparison === 0) {
        const leftMax = Number.isFinite(left.max) ? left.max : Number.POSITIVE_INFINITY;
        const rightMax = Number.isFinite(right.max) ? right.max : Number.POSITIVE_INFINITY;
        comparison = leftMax - rightMax;
      }
    }
    if (comparison !== 0) return comparison * (state.sortDirection === "asc" ? 1 : -1);
    return left.archiveOrder - right.archiveOrder;
  });
}

function levelText(entry) {
  if (!Number.isFinite(entry.min) && !Number.isFinite(entry.max)) return "LEVEL ?";
  const low = Number.isFinite(entry.min) ? entry.min : "?";
  const high = Number.isFinite(entry.max) ? entry.max : "+";
  return `LV ${low}–${high}${entry.level_range_uncertain ? " ?" : ""}`;
}

function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const copyField = makeElement("textarea", "visually-hidden");
    copyField.value = text;
    copyField.setAttribute("readonly", "");
    document.body.append(copyField);
    copyField.select();
    const copied = document.execCommand("copy");
    copyField.remove();
    if (copied) resolve();
    else reject(new Error("Clipboard access was denied."));
  });
}

function announceCopy(message) {
  window.clearTimeout(copyStatusTimeout);
  elements.copyStatus.textContent = message;
  elements.copyStatus.classList.add("is-visible");
  copyStatusTimeout = window.setTimeout(() => {
    elements.copyStatus.classList.remove("is-visible");
  }, 2400);
}

function expandRouteCommands(route) {
  return route.flatMap((command) => {
    const repetition = command.trim().match(/^(\d+)(e|w|n|s|ne|nw|se|sw|u|d)$/i);
    return repetition
      ? Array(Number(repetition[1])).fill(repetition[2].toLocaleLowerCase())
      : [command.trim().toLocaleLowerCase()];
  });
}

function routeListFor(entry) {
  const routes = Array.isArray(entry.routes)
    ? entry.routes.filter((route) => Array.isArray(route) && route.length)
    : [];
  const details = entry.details ?? "";
  const firstSection = details.split("(")[0].trim();
  const routeText = entry.name && firstSection.toLocaleLowerCase().startsWith(entry.name.toLocaleLowerCase())
    ? firstSection.slice(entry.name.length).trim()
    : firstSection;
  const sourceRoute = routeText.split("|").map((command) => command.trim()).filter(Boolean);
  if (routes.length > 1 && sourceRoute.length > 1 && /^tp\s/i.test(sourceRoute[0])) {
    const expectedTail = expandRouteCommands(sourceRoute.slice(1));
    const matchingRouteIndex = routes.findIndex((route) => {
      const expanded = expandRouteCommands(route);
      return expanded.length === expectedTail.length
        && expanded.every((command, index) => command === expectedTail[index]);
    });
    if (matchingRouteIndex >= 0) {
      return [sourceRoute, ...routes.filter((_, index) => index !== matchingRouteIndex)];
    }
  }

  const hasPipeRoute = details.includes("|");
  const hasCompactAlternative = /\([^)]*\b\d+\s*(?:e|w|n|s|ne|nw|se|sw|u|d)\b/i.test(details);
  const hasSeparateOrigins = /\bthen\b|\(\s*from\b/i.test(details);

  if (!hasPipeRoute || !hasCompactAlternative || hasSeparateOrigins || routes.length < 2) {
    return routes;
  }

  const pipeTokens = details.split("|").map((token) => {
    let normalized = token.trim().toLocaleLowerCase().split("(")[0].trim();
    if (entry.name) {
      const name = entry.name.toLocaleLowerCase();
      if (normalized.startsWith(name)) normalized = normalized.slice(name.length).trim();
      normalized = normalized.replace(/^[:\s]+/, "");
    }
    if (entry.name && /^(?:any|all)\s+/i.test(normalized)) {
      normalized = normalized.replace(/^(?:any|all)\s+/i, "");
    }
    return normalized;
  }).filter(Boolean);
  const pipeCounts = new Map();
  for (const token of pipeTokens) pipeCounts.set(token, (pipeCounts.get(token) ?? 0) + 1);

  let bestRoute = routes[0];
  let bestScore = -1;
  let bestMatchCount = -1;
  for (const route of routes) {
    const remaining = new Map(pipeCounts);
    let matched = 0;
    for (const command of route) {
      const token = command.trim().toLocaleLowerCase();
      const count = remaining.get(token) ?? 0;
      if (count > 0) {
        matched += 1;
        remaining.set(token, count - 1);
      }
    }
    const normalizedScore = matched / route.length;
    if (normalizedScore > bestScore
      || (normalizedScore === bestScore && matched > bestMatchCount)
      || (normalizedScore === bestScore && matched === bestMatchCount && route.length > bestRoute.length)) {
      bestRoute = route;
      bestScore = normalizedScore;
      bestMatchCount = matched;
    }
  }
  return [bestRoute];
}

function formatRoute(route) {
  return expandRouteCommands(route).join("  >  ");
}

function renderRoute(route, index, locationName) {
  const copyButton = makeElement("button", "route-copy");
  copyButton.type = "button";
  copyButton.setAttribute("aria-label", `Copy route ${index + 1} for ${locationName}`);
  copyButton.append(
    makeElement("span", "route-label", `${index ? "ALT" : "ROUTE"} ${String(index + 1).padStart(2, "0")}`),
    makeElement("code", "route-code", formatRoute(route)),
    makeElement("span", "route-copy-hint", "⧉ COPY"),
  );
  copyButton.addEventListener("click", async () => {
    try {
      await copyText(expandRouteCommands(route).join("|"));
      announceCopy(`Route ${index + 1} copied — ready for the MUD.`);
    } catch (error) {
      console.error("Could not copy route to clipboard.", error);
      announceCopy("Copy failed. Select the route text and copy it manually.");
    }
  });
  return copyButton;
}

function renderAlternateNote(text) {
  const note = makeElement("div", "alternate-note");
  note.append(
    makeElement("span", "route-label", "ALTERNATE"),
    makeElement("span", "alternate-note-text", text),
  );
  return note;
}

function renderEntry(entry) {
  const row = makeElement("tr", "entry-row");
  const locationCell = makeElement("td", "location-cell");
  const locationName = entry.displayName ?? entry.name ?? (entry.category === "Guild master" ? entry.groupName : "Additional directions");
  locationCell.append(makeElement("span", "entry-name", locationName));
  const typeLabel = entry.category === "Guild master"
    ? "GM"
    : entry.category === "Guild master note"
      ? "GM note"
      : entry.category;
  const typeCell = makeElement("td", "type-cell", typeLabel);
  const levelCell = makeElement("td", "level-cell", levelText(entry));
  const directionsCell = makeElement("td", "directions-cell");
  const alternateEntries = entry.additionalEntries ?? [];
  const primaryRoutes = routeListFor(entry);
  const routes = [
    ...primaryRoutes,
    ...alternateEntries.flatMap((alternate) => routeListFor(alternate)),
  ];
  const alternateNotes = alternateEntries
    .filter((alternate) => routeListFor(alternate).length === 0)
    .map((alternate) => alternate.details?.trim())
    .filter(Boolean);

  if (routes.length) {
    const routeList = makeElement("div", "route-list");
    routes.forEach((route, index) => {
      routeList.append(renderRoute(route, index, locationName));
    });
    alternateNotes.forEach((note) => routeList.append(renderAlternateNote(note)));
    directionsCell.append(routeList);
  } else if (alternateNotes.length) {
    const routeList = makeElement("div", "route-list");
    if (entry.details?.trim()) routeList.append(renderAlternateNote(entry.details.trim()));
    alternateNotes.forEach((note) => routeList.append(renderAlternateNote(note)));
    directionsCell.append(routeList);
  } else {
    directionsCell.append(makeElement("p", "no-route", entry.details?.trim() || "No directions recorded."));
  }
  row.append(locationCell, typeCell, levelCell, directionsCell);
  return row;
}

function updateRangeReadout() {
  state.minLevel = Number(elements.minLevel.value);
  state.maxLevel = Number(elements.maxLevel.value);
  if (state.minLevel > state.maxLevel) {
    if (document.activeElement === elements.minLevel) {
      state.maxLevel = state.minLevel;
      elements.maxLevel.value = String(state.maxLevel);
    } else {
      state.minLevel = state.maxLevel;
      elements.minLevel.value = String(state.minLevel);
    }
  }
  elements.levelReadout.textContent = `${state.minLevel} — ${state.maxLevel}`;
}

function render() {
  if (!state.data) return;
  elements.title.textContent = categoryLabels[state.category];
  const entries = getEntries();
  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => fragment.append(renderEntry(entry)));
  elements.entryList.replaceChildren(fragment);
  elements.sortHeaders.forEach((header) => {
    const selected = header.dataset.sort === state.sortKey;
    header.setAttribute("aria-pressed", String(selected));
    header.closest("th").setAttribute("aria-sort", selected
      ? state.sortDirection === "asc" ? "ascending" : "descending"
      : "none");
    header.querySelector(".sort-indicator").textContent = selected
      ? state.sortDirection === "asc" ? "↑" : "↓"
      : "↕";
  });
  elements.resultCount.textContent = `${String(entries.length).padStart(3, "0")} ${entries.length === 1 ? "ENTRY" : "ENTRIES"}`;
  elements.emptyState.hidden = entries.length > 0;
}

function populateClasses() {
  for (const guild of state.data.guild_masters ?? []) {
    elements.classFilter.append(makeElement("option", "", guild.name));
  }
}

function setCategory(category) {
  state.category = category;
  elements.tabs.forEach((tab) => {
    const selected = tab.dataset.category === category;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
  elements.classFilter.disabled = category !== "guild_masters";
  if (category !== "guild_masters") {
    state.guildClass = "";
    elements.classFilter.value = "";
  }
  render();
}

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setCategory(tab.dataset.category));
});
elements.sortHeaders.forEach((header) => {
  header.addEventListener("click", () => {
    const sortKey = header.dataset.sort;
    if (state.sortKey === sortKey) {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = sortKey;
      state.sortDirection = "asc";
    }
    render();
  });
});
elements.search.addEventListener("input", () => {
  state.search = elements.search.value;
  render();
});
elements.minLevel.addEventListener("input", () => {
  updateRangeReadout();
  render();
});
elements.maxLevel.addEventListener("input", () => {
  updateRangeReadout();
  render();
});
elements.classFilter.addEventListener("change", () => {
  state.guildClass = elements.classFilter.value;
  render();
});
elements.clear.addEventListener("click", () => {
  elements.search.value = "";
  elements.minLevel.value = "0";
  elements.maxLevel.value = "150";
  elements.classFilter.value = "";
  state.search = "";
  state.guildClass = "";
  updateRangeReadout();
  render();
});

fetch("directions.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Failed to load directions.json (${response.status}).`);
    return response.json();
  })
  .then((data) => {
    if (!data || !Array.isArray(data.guild_masters) || !Array.isArray(data.areas) || !Array.isArray(data.mobs)) {
      throw new Error("directions.json does not have the expected archive structure.");
    }
    state.data = data;
    populateClasses();
    elements.loadError.hidden = true;
    render();
  })
  .catch((error) => {
    console.error("Could not load the directions archive.", error);
    elements.resultCount.textContent = "ARCHIVE ERROR";
    elements.loadError.hidden = false;
  });
