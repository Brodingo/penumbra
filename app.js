const state = {
  data: null,
  category: "all",
  search: "",
  minLevel: 0,
  maxLevel: 140,
  guildClass: "",
};

const elements = {
  tabs: [...document.querySelectorAll(".category-tab")],
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
    for (const category of ["areas", "mobs"]) {
      if (state.category === "all" || state.category === category) {
        for (const entry of state.data[category] ?? []) {
          entries.push({
            ...entry,
            category: category === "areas" ? "Area" : "Mob / NPC",
            groupName: entry.name ?? "Unlabelled entry",
          });
        }
      }
    }
  }
  if (state.category === "all" && !state.guildClass) {
    for (const entry of state.data.guild_master_notes ?? []) {
      entries.push({ ...entry, category: "Guild master note", groupName: entry.name ?? "Guild master note" });
    }
  }

  const query = state.search.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
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
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return inLevelRange && (!query || searchable.includes(query));
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

function renderRoute(route, index, cardName) {
  const block = makeElement("div", "route-block");
  const topline = makeElement("div", "route-topline");
  topline.append(makeElement("span", "route-label", `ROUTE ${String(index + 1).padStart(2, "0")}`));

  const copyButton = makeElement("button", "copy-button", "⧉ COPY");
  copyButton.type = "button";
  copyButton.setAttribute("aria-label", `Copy route ${index + 1} for ${cardName}`);
  copyButton.addEventListener("click", async () => {
    try {
      await copyText(route.join("|"));
      announceCopy(`Route ${index + 1} copied — ready for the MUD.`);
    } catch (error) {
      console.error("Could not copy route to clipboard.", error);
      announceCopy("Copy failed. Select the route text and copy it manually.");
    }
  });
  topline.append(copyButton);

  const code = makeElement("code", "route-code", route.join("|"));
  const pre = makeElement("pre");
  pre.append(code);
  block.append(topline, pre);
  return block;
}

function renderEntry(entry) {
  const card = makeElement("article", "entry-card");
  const head = makeElement("div", "entry-head");
  const heading = makeElement("div", "entry-heading");
  heading.append(
    makeElement("div", "entry-type", entry.groupName !== entry.name
      ? `${entry.category} / ${entry.groupName}`
      : entry.category),
    makeElement("h3", "entry-name", entry.name ?? (entry.category === "Guild master" ? entry.groupName : entry.category)),
  );
  head.append(heading, makeElement("span", "level-badge", levelText(entry)));
  card.append(head);

  const notes = entry.details?.trim();
  const routeSource = Array.isArray(entry.routes) && entry.routes.length;
  if (notes && !routeSource) {
    card.append(makeElement("p", "entry-notes", notes));
  }

  if (routeSource) {
    const routeList = makeElement("div", "route-list");
    entry.routes.forEach((route, index) => {
      routeList.append(renderRoute(route, index, entry.name ?? entry.groupName));
    });
    card.append(routeList);
    if (notes) {
      const source = makeElement("details", "source-notes");
      source.append(makeElement("summary", "", "View field notes"));
      source.append(makeElement("p", "", notes));
      const footer = makeElement("div", "entry-foot");
      footer.append(source);
      card.append(footer);
    }
  } else if (notes) {
    card.append(makeElement("p", "no-route", "No route recorded for this entry."));
  }
  return card;
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
  elements.maxLevel.value = "140";
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
