/* =========================================================
   NEXUS WORKSPACE — GESAMTVERSION
   Seiten, Unterseiten, Suche, Favoriten, Autosave,
   Markdown-/JSON-Export, Dark Mode und freie Blockfläche
   ========================================================= */

"use strict";

/* ----------------------------- Konfiguration ----------------------------- */

const STORAGE_KEY = "nexus-workspace-v1";
const THEME_KEY = "nexus-workspace-theme-v1";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const on = (selector, event, handler) => {
  $(selector)?.addEventListener(event, handler);
};

const elements = {
  sidebar: $("#sidebar"),
  sidebarOverlay: $("#sidebarOverlay"),
  pageTree: $("#pageTree"),
  favoriteList: $("#favoriteList"),

  dashboard: $("#dashboard"),
  allPagesView: $("#allPagesView"),
  editorView: $("#editorView"),
  searchView: $("#searchView"),

  recentPages: $("#recentPages"),
  allPagesGrid: $("#allPagesGrid"),
  searchInput: $("#searchInput"),
  searchResults: $("#searchResults"),

  pageTitle: $("#pageTitle"),
  pageContent: $("#pageContent"),
  editorIcon: $("#editorIcon"),
  editorDate: $("#editorDate"),
  wordCount: $("#wordCount"),
  breadcrumbs: $("#breadcrumbs"),
  subpageList: $("#subpageList"),

  pageCount: $("#pageCount"),
  favoriteCount: $("#favoriteCount"),
  lastActivity: $("#lastActivity"),
  saveStatus: $("#saveStatus"),
  favoriteButton: $("#favoriteButton"),

  pageModal: $("#pageModal"),
  pageForm: $("#pageForm"),
  newPageTitle: $("#newPageTitle"),
  newPageType: $("#newPageType"),

  toast: $("#toast"),
  themeButton: $("#themeButton"),
  themeLabel: $("#themeLabel"),
  themeIcon: $("#themeIcon")
};

const views = {
  dashboard: elements.dashboard,
  allPages: elements.allPagesView,
  editor: elements.editorView,
  search: elements.searchView
};

const state = {
  pages: [],
  activePageId: null,
  view: "dashboard"
};

let saveTimer = null;
let toastTimer = null;
let draggedBlock = null;
let insertAfterBlock = null;
let lastFocusedBlock = null;
let composing = false;

/* Standardgrößen für die verschiedenen Blocktypen */

const BLOCK_DEFAULTS = {
  text:    { width: 360, height: 100 },
  h1:      { width: 440, height: 90 },
  h2:      { width: 380, height: 76 },
  todo:    { width: 320, height: 80 },
  bullet:  { width: 320, height: 110 },
  quote:   { width: 360, height: 110 },
  divider: { width: 300, height: 35 }
};

/* ----------------------------- Hilfsfunktionen ----------------------------- */

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function plainText(html) {
  const doc = new DOMParser().parseFromString(
    String(html || ""),
    "text/html"
  );

  return (doc.body.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text) {
  const value = String(text || "").trim();
  return value ? value.split(/\s+/).length : 0;
}

function formatDate(timestamp) {
  if (!timestamp) return "Noch nicht bearbeitet";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

function relativeDate(timestamp) {
  if (!timestamp) return "Noch nicht bearbeitet";

  const date = new Date(timestamp);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return "Heute";
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return "Gestern";
  }

  return formatDate(timestamp);
}

function getPage(id) {
  return state.pages.find(page => page.id === id) || null;
}

function getActivePage() {
  return getPage(state.activePageId);
}

function getChildren(parentId) {
  return state.pages
    .filter(page => page.parentId === parentId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function getRootPages() {
  return getChildren(null);
}

function iconFor(type) {
  const icons = {
    blank: "📄",
    note: "✎",
    project: "◫",
    tasks: "☑",
    home: "⌂"
  };

  return icons[type] || "📄";
}

function toast(message) {
  if (!elements.toast) return;

  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    elements.toast?.classList.remove("show");
  }, 2500);
}

function setSaveStatus(message) {
  if (elements.saveStatus) {
    elements.saveStatus.textContent = message;
  }
}

function numberOr(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : fallback;
}

/* ----------------------------- Seitentemplates ----------------------------- */

function templateContent(type) {
  if (type === "note") {
    return `
      <p></p>
      <h2>Gedanke</h2>
      <p>Was möchtest du festhalten?</p>
      <h2>Weitere Ideen</h2>
      <p></p>
    `;
  }

  if (type === "project") {
    return `
      <p>Ein Ort für Planung, Ideen und Fortschritt.</p>
      <h2>Über das Projekt</h2>
      <p>Was möchtest du erreichen?</p>
      <h2>Ziele</h2>
      <ul>
        <li>Das wichtigste Ziel definieren</li>
        <li>Die nächsten Schritte planen</li>
      </ul>
      <h2>Nächste Schritte</h2>
      <p></p>
      <h2>Notizen</h2>
      <p></p>
    `;
  }

  if (type === "tasks") {
    return `
      <p>Deine Aufgaben für heute.</p>
      <h2>Prioritäten</h2>
      <div class="check-row">
        <input type="checkbox">
        <span>Wichtigste Aufgabe erledigen</span>
      </div>
      <div class="check-row">
        <input type="checkbox">
        <span>Offene Punkte überprüfen</span>
      </div>
      <div class="check-row">
        <input type="checkbox">
        <span>Den nächsten Tag vorbereiten</span>
      </div>
      <h2>Notizen</h2>
      <p></p>
    `;
  }

  return "<p></p>";
}

function createStarterPages() {
  const now = Date.now();

  return [
    {
      id: createId(),
      title: "Willkommen bei Nexus",
      icon: "✦",
      type: "note",
      parentId: null,
      favorite: true,
      content: `
        <p>Dein persönlicher Workspace ist bereit.</p>
        <h2>Alles beginnt mit einer Idee.</h2>
        <p>Hier kannst du Gedanken sammeln, Projekte planen,
        Listen erstellen und dein Wissen organisieren.</p>
        <h2>So funktioniert es</h2>
        <ul>
          <li>Erstelle über + Neu eine eigene Seite.</li>
          <li>Verschiebe Blöcke auf der Arbeitsfläche.</li>
          <li>Markiere wichtige Seiten als Favoriten.</li>
          <li>Nutze die Suche, um Inhalte wiederzufinden.</li>
        </ul>
        <blockquote>Ein guter Gedanke verdient einen Ort,
        an dem er wachsen kann.</blockquote>
        <p>Viel Spaß mit deinem Workspace!</p>
      `,
      createdAt: now,
      updatedAt: now
    },
    {
      id: createId(),
      title: "Mein erstes Projekt",
      icon: "◫",
      type: "project",
      parentId: null,
      favorite: false,
      content: templateContent("project"),
      createdAt: now - 1000,
      updatedAt: now - 1000
    },
    {
      id: createId(),
      title: "Meine Aufgaben",
      icon: "☑",
      type: "tasks",
      parentId: null,
      favorite: false,
      content: templateContent("tasks"),
      createdAt: now - 2000,
      updatedAt: now - 2000
    }
  ];
}

/* ----------------------------- Speichern und Laden ----------------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      state.pages = createStarterPages();
      state.activePageId = null;
      persistImmediately();
      return;
    }

    const saved = JSON.parse(raw);

    if (!saved || !Array.isArray(saved.pages)) {
      throw new Error("Ungültiges Datenformat");
    }

    const seen = new Set();

    state.pages = saved.pages
      .filter(page => {
        if (
          !page ||
          typeof page.id !== "string" ||
          typeof page.title !== "string" ||
          seen.has(page.id)
        ) {
          return false;
        }

        seen.add(page.id);
        return true;
      })
      .map(page => ({
        id: page.id,
        title: page.title.slice(0, 180),
        icon: typeof page.icon === "string"
          ? page.icon.slice(0, 10)
          : "📄",
        type: ["blank", "note", "project", "tasks"].includes(page.type)
          ? page.type
          : "blank",
        parentId: typeof page.parentId === "string"
          ? page.parentId
          : null,
        favorite: Boolean(page.favorite),
        content: typeof page.content === "string"
          ? page.content
          : "",
        createdAt: Number(page.createdAt) || Date.now(),
        updatedAt: Number(page.updatedAt) || Date.now()
      }));

    const ids = new Set(state.pages.map(page => page.id));

    state.pages.forEach(page => {
      if (
        !page.parentId ||
        !ids.has(page.parentId) ||
        page.parentId === page.id
      ) {
        page.parentId = null;
      }
    });

    /* Ungültige oder zyklische Unterseitenverweise korrigieren. */

    state.pages.forEach(page => {
      const path = new Set([page.id]);
      let parent = getPage(page.parentId);

      while (parent) {
        if (path.has(parent.id)) {
          page.parentId = null;
          break;
        }

        path.add(parent.id);
        parent = getPage(parent.parentId);
      }
    });

    state.activePageId = getPage(saved.activePageId)?.id || null;
  } catch (error) {
    console.error("Nexus: Laden fehlgeschlagen", error);

    state.pages = createStarterPages();
    state.activePageId = null;

    toast("Gespeicherte Daten konnten nicht gelesen werden.");
  }
}

function persistImmediately() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pages: state.pages,
      activePageId: state.activePageId
    }));

    setSaveStatus("Gespeichert");
    return true;
  } catch (error) {
    console.error("Nexus: Speichern fehlgeschlagen", error);

    setSaveStatus("Speicherfehler");
    toast("Speichern fehlgeschlagen. Prüfe deinen Browserspeicher.");

    return false;
  }
}

function saveState() {
  setSaveStatus("Speichert …");

  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistImmediately, 300);
}

/* ----------------------------- Navigation ----------------------------- */

function setView(view) {
  state.view = views[view] ? view : "dashboard";

  Object.values(views).forEach(element => {
    element?.classList.add("hidden");
  });

  views[state.view]?.classList.remove("hidden");

  $$(".sidebar-actions .nav-item").forEach(button => {
    button.classList.remove("active");
  });

  const activeNav = {
    dashboard: "#homeButton",
    allPages: "#allPagesButton",
    search: "#searchButton"
  }[state.view];

  if (activeNav) {
    $(activeNav)?.classList.add("active");
  }

  renderBreadcrumbs();
  closeSidebar();
}

function renderBreadcrumbs() {
  if (!elements.breadcrumbs) return;

  elements.breadcrumbs.replaceChildren();

  function addCrumb(label, action, current = false) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "breadcrumb-link";
    button.textContent = label;
    button.disabled = current;

    button.addEventListener("click", action);

    elements.breadcrumbs.append(button);
  }

  function addSeparator() {
    const separator = document.createElement("span");

    separator.className = "breadcrumb-separator";
    separator.textContent = "/";

    elements.breadcrumbs.append(separator);
  }

  addCrumb("Nexus", goHome, state.view === "dashboard");

  if (state.view === "editor" && getActivePage()) {
    const chain = [];
    let page = getActivePage();
    const visited = new Set();

    while (page && !visited.has(page.id)) {
      visited.add(page.id);
      chain.unshift(page);
      page = getPage(page.parentId);
    }

    chain.forEach((item, index) => {
      addSeparator();

      addCrumb(
        item.title || "Unbenannte Seite",
        () => openPage(item.id),
        index === chain.length - 1
      );
    });

    return;
  }

  if (state.view !== "dashboard") {
    addSeparator();

    addCrumb(
      ({ allPages: "Alle Seiten", search: "Suche" })[state.view]
        || "Startseite",
      () => {},
      true
    );
  }
}

function goHome() {
  state.activePageId = null;

  setView("dashboard");
  renderAll();
  saveState();
}

function openSearch() {
  setView("search");

  renderSearch(elements.searchInput?.value || "");
  elements.searchInput?.focus();
}

function openAllPages() {
  setView("allPages");
  renderAllPages();
}

function openSidebar() {
  elements.sidebar?.classList.add("open");
  elements.sidebarOverlay?.classList.add("active");
}

function closeSidebar() {
  elements.sidebar?.classList.remove("open");
  elements.sidebarOverlay?.classList.remove("active");
}

/* ----------------------------- Seitenleiste ----------------------------- */

function createTreeElement(page, depth = 0) {
  const item = document.createElement("div");

  item.className = "tree-item";
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.style.paddingLeft = `${7 + Math.min(depth, 5) * 12}px`;

  if (page.id === state.activePageId && state.view === "editor") {
    item.classList.add("active");
  }

  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.textContent = page.icon || "📄";

  const title = document.createElement("span");
  title.className = "tree-title";
  title.textContent = page.title || "Unbenannte Seite";

  item.append(icon, title);

  if (page.favorite) {
    const star = document.createElement("span");
    star.className = "tree-fav";
    star.textContent = "★";
    item.append(star);
  }

  if (getChildren(page.id).length) {
    const arrow = document.createElement("span");
    arrow.className = "tree-arrow";
    arrow.textContent = "↳";
    item.append(arrow);
  }

  item.addEventListener("click", () => openPage(page.id));

  item.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPage(page.id);
    }
  });

  return item;
}

function renderTreeItem(page, container, depth = 0) {
  if (depth > 20) return;

  container.append(createTreeElement(page, depth));

  getChildren(page.id).forEach(child => {
    renderTreeItem(child, container, depth + 1);
  });
}

function renderSidebar() {
  if (elements.pageTree) {
    elements.pageTree.replaceChildren();

    const roots = getRootPages();

    if (!roots.length) {
      const empty = document.createElement("div");
      empty.className = "tree-empty";
      empty.textContent = "Noch keine Seiten. Erstelle deine erste!";

      elements.pageTree.append(empty);
    }

    roots.forEach(page => {
      renderTreeItem(page, elements.pageTree);
    });
  }

  if (elements.favoriteList) {
    elements.favoriteList.replaceChildren();

    const favorites = state.pages
      .filter(page => page.favorite)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (!favorites.length) {
      const empty = document.createElement("div");
      empty.className = "tree-empty";
      empty.textContent = "Deine Favoriten erscheinen hier.";

      elements.favoriteList.append(empty);
    } else {
      favorites.forEach(page => {
        elements.favoriteList.append(createTreeElement(page));
      });
    }
  }
}

/* ----------------------------- Dashboard und Karten ----------------------------- */

function createEmptyState(title, description, buttonText, action) {
  const box = document.createElement("div");
  box.className = "empty-state";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = description;

  box.append(heading, paragraph);

  if (buttonText && action) {
    const button = document.createElement("button");

    button.className = "primary-btn";
    button.textContent = buttonText;
    button.addEventListener("click", action);

    box.append(button);
  }

  return box;
}

function createPageCard(page) {
  const card = document.createElement("article");

  card.className = "page-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Seite öffnen: ${page.title}`);

  const top = document.createElement("div");
  top.className = "page-card-top";

  const icon = document.createElement("span");
  icon.className = "page-card-icon";
  icon.textContent = page.icon || "📄";

  top.append(icon);

  if (page.favorite) {
    const star = document.createElement("span");
    star.className = "page-card-fav";
    star.textContent = "★";
    top.append(star);
  }

  const title = document.createElement("h3");
  title.textContent = page.title || "Unbenannte Seite";

  const description = document.createElement("p");
  description.textContent =
    plainText(page.content) || "Noch kein Inhalt vorhanden.";

  const date = document.createElement("span");
  date.className = "page-card-date";
  date.textContent = relativeDate(page.updatedAt);

  card.append(top, title, description, date);

  card.addEventListener("click", () => openPage(page.id));

  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPage(page.id);
    }
  });

  return card;
}

function renderDashboard() {
  const pages = [...state.pages]
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (elements.pageCount) {
    elements.pageCount.textContent = state.pages.length;
  }

  if (elements.favoriteCount) {
    elements.favoriteCount.textContent =
      state.pages.filter(page => page.favorite).length;
  }

  if (elements.lastActivity) {
    elements.lastActivity.textContent = pages.length
      ? relativeDate(pages[0].updatedAt)
      : "Noch nichts";
  }

  if (!elements.recentPages) return;

  elements.recentPages.replaceChildren();

  if (!pages.length) {
    elements.recentPages.append(
      createEmptyState(
        "Dein Workspace ist noch leer.",
        "Erstelle deine erste Seite und sammle deine Ideen.",
        "Erste Seite erstellen",
        () => openNewPageModal()
      )
    );

    return;
  }

  pages.slice(0, 3).forEach(page => {
    elements.recentPages.append(createPageCard(page));
  });
}

function renderAllPages() {
  if (!elements.allPagesGrid) return;

  elements.allPagesGrid.replaceChildren();

  const pages = [...state.pages]
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (!pages.length) {
    elements.allPagesGrid.append(
      createEmptyState(
        "Noch keine Seiten vorhanden.",
        "Erstelle eine Seite, um deine Sammlung aufzubauen.",
        "Neue Seite",
        () => openNewPageModal()
      )
    );

    return;
  }

  pages.forEach(page => {
    elements.allPagesGrid.append(createPageCard(page));
  });
}

function renderAll() {
  renderSidebar();
  renderDashboard();
  renderAllPages();
  updateFavoriteButton();
}

/* ----------------------------- Seiten und Unterseiten erstellen ----------------------------- */

function openNewPageModal(type = "blank", parentId = null) {
  if (!elements.pageModal || !elements.pageForm) return;

  elements.pageForm.reset();

  if (elements.newPageType) {
    elements.newPageType.value = type;
  }

  const parent = getPage(parentId);

  if (elements.newPageTitle) {
    elements.newPageTitle.placeholder = parent
      ? `Unterseite von ${parent.title}`
      : "z. B. Meine Ideen";
  }

  elements.pageModal.dataset.parentId = parentId || "";
  elements.pageModal.classList.remove("hidden");

  requestAnimationFrame(() => elements.newPageTitle?.focus());
}

function closeNewPageModal() {
  elements.pageModal?.classList.add("hidden");

  if (elements.pageModal) {
    elements.pageModal.dataset.parentId = "";
  }
}

function createPage(title, type = "blank", parentId = null) {
  const now = Date.now();

  const page = {
    id: createId(),
    title: title.trim().slice(0, 180) || "Unbenannte Seite",
    icon: iconFor(type),
    type,
    parentId: getPage(parentId) ? parentId : null,
    favorite: false,
    content: templateContent(type),
    createdAt: now,
    updatedAt: now
  };

  state.pages.push(page);
  state.activePageId = page.id;

  renderAll();
  openPage(page.id);
  saveState();

  toast("Seite erstellt");
}

function renderSubpages() {
  if (!elements.subpageList) return;

  elements.subpageList.replaceChildren();

  const page = getActivePage();
  if (!page) return;

  const children = getChildren(page.id);

  if (!children.length) {
    const empty = document.createElement("div");

    empty.className = "tree-empty";
    empty.style.paddingLeft = "0";
    empty.textContent =
      "Noch keine Unterseiten. Erstelle eine über „+ Unterseite“.";

    elements.subpageList.append(empty);
    return;
  }

  children.forEach(child => {
    const row = document.createElement("div");

    row.className = "subpage-row";
    row.tabIndex = 0;
    row.setAttribute("role", "button");

    const icon = document.createElement("span");
    icon.textContent = child.icon || "📄";

    const title = document.createElement("strong");
    title.textContent = child.title;

    const arrow = document.createElement("span");
    arrow.textContent = "→";

    row.append(icon, title, arrow);

    row.addEventListener("click", () => openPage(child.id));

    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPage(child.id);
      }
    });

    elements.subpageList.append(row);
  });
}

/* ----------------------------- Blockeditor: Sicherheit und Typen ----------------------------- */

function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(
    String(html || ""),
    "text/html"
  );

  doc.body.querySelectorAll(
    "script, iframe, object, embed, form"
  ).forEach(node => node.remove());

  doc.body.querySelectorAll("*").forEach(node => {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (
        name.startsWith("on") ||
        (
          ["href", "src"].includes(name) &&
          value.startsWith("javascript:")
        )
      ) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return doc.body.innerHTML;
}

function placeholderForBlock(type) {
  const placeholders = {
    text: "Schreibe etwas …",
    h1: "Große Überschrift",
    h2: "Überschrift",
    todo: "Neue Aufgabe",
    bullet: "Listeneintrag",
    quote: "Zitat schreiben …",
    divider: ""
  };

  return placeholders[type] || "Schreibe etwas …";
}

function detectBlockType(html) {
  const doc = new DOMParser().parseFromString(
    html || "",
    "text/html"
  );

  const node = doc.body.firstElementChild;

  if (!node) return "text";

  const tag = node.tagName.toLowerCase();

  if (tag === "h1") return "h1";
  if (tag === "h2" || tag === "h3") return "h2";
  if (tag === "blockquote") return "quote";
  if (tag === "hr") return "divider";
  if (tag === "ul" || tag === "ol") return "bullet";

  if (
    node.matches(".check-row") ||
    node.querySelector('.check-row, input[type="checkbox"]')
  ) {
    return "todo";
  }

  return "text";
}

function normalizeBlockHTML(html, type) {
  const safe = sanitizeHTML(html);

  if (type === "divider") {
    return "<hr>";
  }

  const doc = new DOMParser().parseFromString(safe, "text/html");

  if (type === "todo") {
    const row = doc.body.querySelector(".check-row");

    if (row) return row.outerHTML;

    const checkbox = doc.body.querySelector('input[type="checkbox"]');
    const checked = checkbox?.checked ? " checked" : "";

    return `
      <div class="check-row">
        <input type="checkbox"${checked}>
        <span>${escapeHTML(plainText(safe) || "Neue Aufgabe")}</span>
      </div>
    `;
  }

  if (type === "h1" || type === "h2") {
    const first = doc.body.firstElementChild;

    const inner = first && /^H[1-6]$/.test(first.tagName)
      ? first.innerHTML
      : doc.body.innerHTML;

    return `<${type}>${inner || "<br>"}</${type}>`;
  }

  if (type === "quote") {
    const first = doc.body.firstElementChild;

    return first?.tagName === "BLOCKQUOTE"
      ? first.outerHTML
      : `<blockquote>${doc.body.innerHTML || "<br>"}</blockquote>`;
  }

  if (type === "bullet") {
    const first = doc.body.firstElementChild;

    return first && ["UL", "OL"].includes(first.tagName)
      ? first.outerHTML
      : `<ul><li>${escapeHTML(plainText(safe) || "Listeneintrag")}</li></ul>`;
  }

  return safe || "<p><br></p>";
}

/* ----------------------------- Gespeicherte Blöcke laden ----------------------------- */

function readSavedBlocks(html) {
  const doc = new DOMParser().parseFromString(
    html || "",
    "text/html"
  );

  const savedBlocks = [
    ...doc.body.querySelectorAll(":scope > [data-nexus-block='true']")
  ];

  /* Bereits gespeicherte Nexus-Blöcke mitsamt Positionen laden. */

  if (savedBlocks.length) {
    return savedBlocks.map((node, index) => {
      const type = node.dataset.type || detectBlockType(node.innerHTML);
      const defaults = BLOCK_DEFAULTS[type] || BLOCK_DEFAULTS.text;

      return {
        type,
        html: node.innerHTML,
        x: numberOr(node.dataset.x, 32 + (index % 2) * 420),
        y: numberOr(node.dataset.y, 32 + Math.floor(index / 2) * 180),
        width: numberOr(node.dataset.width, defaults.width)
      };
    });
  }

  /* Ältere Seiten automatisch in einzelne Blöcke umwandeln. */

  const nodes = [...doc.body.childNodes].filter(node => {
    return node.nodeType === Node.ELEMENT_NODE ||
      (
        node.nodeType === Node.TEXT_NODE &&
        node.textContent.trim()
      );
  });

  return nodes.map((node, index) => {
    const blockHTML = node.nodeType === Node.TEXT_NODE
      ? `<p>${escapeHTML(node.textContent)}</p>`
      : node.outerHTML;

    const type = detectBlockType(blockHTML);
    const defaults = BLOCK_DEFAULTS[type] || BLOCK_DEFAULTS.text;

    return {
      type,
      html: blockHTML,
      x: 32 + (index % 2) * 420,
      y: 32 + Math.floor(index / 2) * 180,
      width: defaults.width
    };
  });
}

function canvasBlocks() {
  if (!elements.pageContent) return [];

  return $$(":scope > .editor-block", elements.pageContent);
}

function makeControl(label, className, title) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = `block-control ${className || ""}`.trim();
  button.textContent = label;
  button.title = title || label;
  button.setAttribute("aria-label", title || label);

  return button;
}

/* ----------------------------- Einzelnen Block erstellen ----------------------------- */

function createEditorBlock(type = "text", html = "", position = {}) {
  const canvas = elements.pageContent;

  const block = document.createElement("section");

  block.className = "editor-block";
  block.dataset.blockType = type;
  block.style.position = "absolute";

  const defaults = BLOCK_DEFAULTS[type] || BLOCK_DEFAULTS.text;

  block.dataset.x = String(numberOr(position.x, 32));
  block.dataset.y = String(numberOr(position.y, 32));
  block.dataset.width = String(numberOr(position.width, defaults.width));

  block.style.left = `${block.dataset.x}px`;
  block.style.top = `${block.dataset.y}px`;
  block.style.width = `${block.dataset.width}px`;
  block.style.maxWidth = "calc(100% - 24px)";

  /* Blocksteuerung */

  const controls = document.createElement("div");
  controls.className = "block-controls";

  const handle = makeControl(
    "⠿",
    "drag-handle",
    "Block frei verschieben"
  );

  handle.draggable = true;

  const add = makeControl(
    "+",
    "add-after",
    "Block hinzufügen"
  );

  const remove = makeControl(
    "×",
    "delete-block",
    "Block löschen"
  );

  controls.append(handle, add, remove);

  /* Editierbarer Inhalt */

  const body = document.createElement("div");
  body.className = "block-body";

  const editor = document.createElement("div");

  editor.className = "block-text";
  editor.contentEditable = type === "divider" ? "false" : "true";
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-multiline", "true");
  editor.dataset.placeholder = placeholderForBlock(type);

  editor.innerHTML = type === "divider"
    ? "<hr>"
    : normalizeBlockHTML(html, type);

  body.append(editor);
  block.append(controls, body);

  editor.addEventListener("focus", () => {
    lastFocusedBlock = block;
  });

  editor.addEventListener("input", () => {
    insertAfterBlock = block;
    updateCanvasHeight();
    saveEditor();
  });

  editor.addEventListener("keydown", handleBlockKeydown);

  editor.addEventListener("paste", event => {
    event.preventDefault();

    const text = event.clipboardData?.getData("text/plain") || "";

    document.execCommand("insertText", false, text);
    saveEditor();
  });

  /* Neuen Block unter dem aktuellen Block hinzufügen */

  add.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  add.addEventListener("click", () => {
    insertAfterBlock = block;
    openBlockMenu(add);
  });

  /* Block löschen */

  remove.addEventListener("click", () => {
    const blocks = canvasBlocks();

    if (blocks.length <= 1) {
      editor.innerHTML = type === "divider"
        ? "<hr>"
        : "<p><br></p>";
    } else {
      block.remove();
    }

    updateCanvasHeight();
    saveEditor();
  });

  /* HTML-Drag-and-drop als zusätzliche Verschiebemöglichkeit */

  handle.addEventListener("dragstart", event => {
    draggedBlock = block;
    block.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", block.dataset.blockType);
    }
  });

  handle.addEventListener("dragend", () => {
    block.classList.remove("is-dragging");

    $$(
      ".drop-target",
      elements.pageContent
    ).forEach(item => item.classList.remove("drop-target"));

    draggedBlock = null;
    saveEditor();
  });

  block.addEventListener("dragover", event => {
    if (!draggedBlock || draggedBlock === block) return;

    event.preventDefault();
    block.classList.add("drop-target");
  });

  block.addEventListener("dragleave", () => {
    block.classList.remove("drop-target");
  });

  block.addEventListener("drop", event => {
    if (!draggedBlock || draggedBlock === block) return;

    event.preventDefault();
    block.classList.remove("drop-target");

    const rect = block.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const x = Math.max(
      12,
      rect.left - canvasRect.left + canvas.scrollLeft
    );

    const y = Math.max(
      12,
      rect.top - canvasRect.top + canvas.scrollTop + rect.height + 18
    );

    draggedBlock.style.left = `${x}px`;
    draggedBlock.style.top = `${y}px`;

    draggedBlock.dataset.x = String(Math.round(x));
    draggedBlock.dataset.y = String(Math.round(y));

    updateCanvasHeight();
    saveEditor();
  });

  /* Freies Verschieben über Maus, Stift oder Touch */

  handle.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;

    const startLeft = numberOr(block.dataset.x, 0);
    const startTop = numberOr(block.dataset.y, 0);

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* Pointer Capture ist nicht in jedem Browser verfügbar. */
    }

    const move = moveEvent => {
      const x = Math.max(
        8,
        startLeft + moveEvent.clientX - startX
      );

      const y = Math.max(
        8,
        startTop + moveEvent.clientY - startY
      );

      block.style.left = `${x}px`;
      block.style.top = `${y}px`;

      block.dataset.x = String(Math.round(x));
      block.dataset.y = String(Math.round(y));

      updateCanvasHeight();
    };

    const finish = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);

      saveEditor();
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });

  return block;
}

/* ----------------------------- Arbeitsfläche skalieren ----------------------------- */

function updateCanvasHeight() {
  if (!elements.pageContent) return;

  let maxX = 800;
  let maxY = 600;

  canvasBlocks().forEach(block => {
    const x = numberOr(block.dataset.x, 0);
    const y = numberOr(block.dataset.y, 0);

    maxX = Math.max(maxX, x + block.offsetWidth + 80);
    maxY = Math.max(maxY, y + block.offsetHeight + 80);
  });

  elements.pageContent.style.position = "relative";
  elements.pageContent.style.minWidth = `${maxX}px`;
  elements.pageContent.style.minHeight = `${maxY}px`;
}

/* ----------------------------- Arbeitsfläche rendern ----------------------------- */

function renderBlockCanvas(html) {
  const canvas = elements.pageContent;

  if (!canvas) return;

  canvas.replaceChildren();
  canvas.style.position = "relative";
  canvas.style.minHeight = "600px";

  const blocks = readSavedBlocks(html);

  if (!blocks.length) {
    blocks.push({
      type: "text",
      html: "<p><br></p>",
      x: 32,
      y: 32,
      width: 360
    });
  }

  blocks.forEach(item => {
    canvas.append(
      createEditorBlock(item.type, item.html, item)
    );
  });

  updateCanvasHeight();
}

/* ----------------------------- Arbeitsfläche speichern ----------------------------- */

function getCanvasHTML() {
  return canvasBlocks().map(block => {
    const editor = $(".block-text", block);

    if (!editor) return "";

    const type = block.dataset.blockType || "text";

    const inner = type === "divider"
      ? "<hr>"
      : sanitizeHTML(editor.innerHTML || "<p><br></p>");

    const wrapper = document.createElement("div");

    wrapper.dataset.nexusBlock = "true";
    wrapper.dataset.type = type;
    wrapper.dataset.x = String(numberOr(block.dataset.x, 32));
    wrapper.dataset.y = String(numberOr(block.dataset.y, 32));
    wrapper.dataset.width = String(
      numberOr(
        block.dataset.width,
        BLOCK_DEFAULTS[type]?.width || 360
      )
    );

    wrapper.innerHTML = inner;

    return wrapper.outerHTML;
  }).join("\n");
}

function saveEditor() {
  const page = getActivePage();

  if (!page || !elements.pageTitle || !elements.pageContent) {
    return;
  }

  page.title =
    elements.pageTitle.value.trim().slice(0, 180) ||
    "Unbenannte Seite";

  page.content = getCanvasHTML();
  page.updatedAt = Date.now();

  if (elements.editorDate) {
    elements.editorDate.textContent = formatDate(page.updatedAt);
  }

  updateWordCount();
  renderSidebar();
  renderDashboard();
  renderAllPages();
  renderSubpages();
  renderBreadcrumbs();
  saveState();
}

function updateWordCount() {
  if (!elements.wordCount) return;

  const title = elements.pageTitle?.value || "";
  const text = plainText(getCanvasHTML());
  const count = countWords(`${title} ${text}`);

  elements.wordCount.textContent =
    `${count} ${count === 1 ? "Wort" : "Wörter"}`;
}

/* ----------------------------- Seiten öffnen ----------------------------- */

function openPage(id) {
  const page = getPage(id);

  if (!page) return;

  state.activePageId = page.id;
  page.updatedAt = Date.now();

  if (elements.pageTitle) {
    elements.pageTitle.value = page.title;
  }

  if (elements.editorIcon) {
    elements.editorIcon.textContent = page.icon || "📄";
  }

  if (elements.editorDate) {
    elements.editorDate.textContent = formatDate(page.updatedAt);
  }

  renderBlockCanvas(page.content);
  updateWordCount();
  updateFavoriteButton();
  renderSidebar();
  renderSubpages();
  setView("editor");
  saveState();
}

/* ----------------------------- Block-Tastatursteuerung ----------------------------- */

function handleBlockKeydown(event) {
  const editor = event.currentTarget;
  const block = editor.closest(".editor-block");

  if (!block) return;

  if (
    event.key === "/" &&
    editor.textContent.trim() === ""
  ) {
    event.preventDefault();

    insertAfterBlock = block;
    openBlockMenu(editor);

    return;
  }

  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    ["h1", "h2", "quote", "divider"].includes(block.dataset.blockType)
  ) {
    event.preventDefault();
    insertBlock("text", block);
    return;
  }

  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    block.dataset.blockType === "todo"
  ) {
    event.preventDefault();
    insertBlock("todo", block);
    return;
  }

  if (
    event.key === "Backspace" &&
    editor.textContent.trim() === "" &&
    canvasBlocks().length > 1
  ) {
    event.preventDefault();

    const target = block.previousElementSibling ||
      block.nextElementSibling;

    block.remove();
    updateCanvasHeight();
    saveEditor();

    $(".block-text", target)?.focus();
  }
}

/* ----------------------------- Block-Menü ----------------------------- */

function openBlockMenu(anchor) {
  const menu = $("#blockMenu");

  if (!menu || !anchor) return;

  const rect = anchor.getBoundingClientRect();

  menu.style.position = "fixed";

  menu.style.left = `${Math.max(
    12,
    Math.min(
      rect.left,
      window.innerWidth - Math.min(menu.offsetWidth || 280, 320) - 12
    )
  )}px`;

  menu.style.top = `${Math.max(
    12,
    Math.min(
      rect.bottom + 6,
      window.innerHeight - (menu.offsetHeight || 300) - 12
    )
  )}px`;

  menu.classList.remove("hidden");
}

function closeBlockMenu() {
  $("#blockMenu")?.classList.add("hidden");
}

function insertBlock(
  type,
  afterBlock = insertAfterBlock || lastFocusedBlock
) {
  if (!elements.pageContent) return;

  const blocks = canvasBlocks();

  const reference =
    afterBlock && afterBlock.parentElement === elements.pageContent
      ? afterBlock
      : blocks.at(-1) || null;

  let x = reference
    ? numberOr(reference.dataset.x, 32)
    : 32;

  let y = reference
    ? numberOr(reference.dataset.y, 32) +
      (reference.offsetHeight || 90) + 24
    : 32;

  /* Neue Blöcke nicht exakt übereinander platzieren. */

  if (
    reference &&
    blocks.some(block =>
      block !== reference &&
      numberOr(block.dataset.x, -1) === x &&
      numberOr(block.dataset.y, -1) === y
    )
  ) {
    x += 28;
  }

  const block = createEditorBlock(type, "", {
    x,
    y,
    width: BLOCK_DEFAULTS[type]?.width || 360
  });

  if (reference) {
    reference.after(block);
  } else {
    elements.pageContent.append(block);
  }

  insertAfterBlock = block;
  lastFocusedBlock = block;

  closeBlockMenu();
  updateCanvasHeight();
  saveEditor();

  const editor = $(".block-text", block);

  if (editor?.contentEditable === "true") {
    editor.focus();

    const range = document.createRange();

    range.selectNodeContents(editor);
    range.collapse(false);

    const selection = window.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

on("#addBlockButton", "click", event => {
  insertAfterBlock =
    lastFocusedBlock ||
    canvasBlocks().at(-1) ||
    null;

  openBlockMenu(event.currentTarget);
});

$$("[data-new-block]").forEach(button => {
  button.addEventListener("click", () => {
    insertBlock(button.dataset.newBlock, insertAfterBlock);
  });
});

document.addEventListener("click", event => {
  const menu = $("#blockMenu");

  if (!menu || menu.classList.contains("hidden")) return;

  if (
    menu.contains(event.target) ||
    event.target.closest("#addBlockButton, .block-control")
  ) {
    return;
  }

  closeBlockMenu();
});

/* ----------------------------- Formatierungswerkzeuge ----------------------------- */

function runEditorCommand(command, value = null) {
  const target =
    document.activeElement?.closest?.(".block-text") ||
    $(".block-text:focus") ||
    $(".block-text", elements.pageContent);

  if (!target || target.contentEditable !== "true") {
    toast("Klicke zuerst in einen Textblock.");
    return;
  }

  target.focus();

  document.execCommand(command, false, value);
  saveEditor();
}

$$("[data-command]").forEach(button => {
  button.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    runEditorCommand(button.dataset.command);
  });
});

$$("[data-block]").forEach(button => {
  button.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    runEditorCommand(
      "formatBlock",
      button.dataset.block.toUpperCase()
    );
  });
});

on("#checklistButton", "mousedown", event => {
  event.preventDefault();
});

on("#checklistButton", "click", () => {
  insertBlock(
    "todo",
    lastFocusedBlock || canvasBlocks().at(-1)
  );
});

on("#linkButton", "mousedown", event => {
  event.preventDefault();
});

on("#linkButton", "click", () => {
  const raw = prompt("Welche Webadresse soll verlinkt werden?");

  if (!raw) return;

  let url;

  try {
    const value = raw.trim();

    url = new URL(
      /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
        ? value
        : `https://${value}`
    );
  } catch {
    toast("Bitte gib eine gültige Webadresse ein.");
    return;
  }

  if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
    toast("Dieser Linktyp wird nicht unterstützt.");
    return;
  }

  runEditorCommand("createLink", url.href);

  $$(".block-text a", elements.pageContent).forEach(link => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  saveEditor();
});

on("#clearFormatButton", "mousedown", event => {
  event.preventDefault();
});

on("#clearFormatButton", "click", () => {
  runEditorCommand("removeFormat");
  runEditorCommand("formatBlock", "P");
});

/* ----------------------------- Favoriten ----------------------------- */

function updateFavoriteButton() {
  const page = getActivePage();

  if (!elements.favoriteButton) return;

  const active = Boolean(page?.favorite);

  elements.favoriteButton.classList.toggle("is-favorite", active);
  elements.favoriteButton.textContent = active ? "★" : "☆";

  elements.favoriteButton.title = active
    ? "Aus Favoriten entfernen"
    : "Zu Favoriten hinzufügen";
}

on("#favoriteButton", "click", () => {
  const page = getActivePage();

  if (!page) {
    toast("Öffne zuerst eine Seite.");
    return;
  }

  page.favorite = !page.favorite;
  page.updatedAt = Date.now();

  updateFavoriteButton();
  renderAll();
  saveState();

  toast(
    page.favorite
      ? "Zu Favoriten hinzugefügt"
      : "Aus Favoriten entfernt"
  );
});

/* ----------------------------- Seiten löschen ----------------------------- */

function collectDescendantIds(id, result = new Set()) {
  getChildren(id).forEach(child => {
    if (!result.has(child.id)) {
      result.add(child.id);
      collectDescendantIds(child.id, result);
    }
  });

  return result;
}

on("#deletePageButton", "click", () => {
  const page = getActivePage();

  if (!page) return;

  const descendants = collectDescendantIds(page.id);
  const total = descendants.size + 1;

  const message = total > 1
    ? `„${page.title}“ und ${descendants.size} Unterseite(n) löschen?`
    : `„${page.title}“ wirklich löschen?`;

  if (!confirm(
    `${message}\n\nDiese Aktion kann nicht rückgängig gemacht werden.`
  )) {
    return;
  }

  const ids = new Set([page.id, ...descendants]);

  state.pages = state.pages.filter(item => !ids.has(item.id));
  state.activePageId = null;

  saveState();
  renderAll();
  goHome();

  toast(
    total > 1
      ? "Seite und Unterseiten gelöscht"
      : "Seite gelöscht"
  );
});

/* ----------------------------- Suche ----------------------------- */

function renderSearch(query = "") {
  if (!elements.searchResults) return;

  elements.searchResults.replaceChildren();

  const normalized = query.trim().toLocaleLowerCase("de");

  if (!normalized) {
    elements.searchResults.append(
      createEmptyState(
        "Was suchst du?",
        "Gib einen Titel oder ein Stichwort ein. Seiteninhalte werden ebenfalls durchsucht.",
        null,
        null
      )
    );

    return;
  }

  const matches = state.pages
    .filter(page =>
      `${page.title} ${plainText(page.content)}`
        .toLocaleLowerCase("de")
        .includes(normalized)
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (!matches.length) {
    elements.searchResults.append(
      createEmptyState(
        "Keine Treffer gefunden.",
        "Versuche einen anderen Suchbegriff oder erstelle eine neue Seite.",
        "Neue Seite erstellen",
        () => openNewPageModal()
      )
    );

    return;
  }

  matches.forEach(page => {
    const row = document.createElement("div");

    row.className = "search-result";
    row.tabIndex = 0;
    row.setAttribute("role", "button");

    const icon = document.createElement("span");
    icon.className = "search-result-icon";
    icon.textContent = page.icon || "📄";

    const info = document.createElement("div");
    info.className = "search-result-info";

    const title = document.createElement("strong");
    title.textContent = page.title;

    const description = document.createElement("p");
    description.textContent =
      plainText(page.content) || "Kein Inhalt";

    info.append(title, description);

    const arrow = document.createElement("span");
    arrow.textContent = "→";

    row.append(icon, info, arrow);

    row.addEventListener("click", () => openPage(page.id));

    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPage(page.id);
      }
    });

    elements.searchResults.append(row);
  });
}

on("#searchInput", "input", event => {
  renderSearch(event.target.value);
});

/* ----------------------------- Modalfenster und Navigation ----------------------------- */

elements.pageForm?.addEventListener("submit", event => {
  event.preventDefault();

  const title = elements.newPageTitle?.value.trim() || "";
  const type = elements.newPageType?.value || "blank";
  const parentId = elements.pageModal?.dataset.parentId || null;

  if (!title) {
    elements.newPageTitle?.focus();
    return;
  }

  closeNewPageModal();
  createPage(title, type, parentId);
});

on("#newPageButton", "click", () => openNewPageModal());
on("#topNewPageButton", "click", () => openNewPageModal());
on("#heroNewPage", "click", () => openNewPageModal());

on("#closeModal", "click", closeNewPageModal);
on("#cancelModal", "click", closeNewPageModal);

elements.pageModal?.addEventListener("click", event => {
  if (event.target === elements.pageModal) {
    closeNewPageModal();
  }
});

on("#addSubpageButton", "click", () => {
  const page = getActivePage();

  if (page) {
    openNewPageModal("blank", page.id);
  }
});

on("#searchButton", "click", openSearch);
on("#homeButton", "click", goHome);
on("#allPagesButton", "click", openAllPages);
on("#viewAllButton", "click", openAllPages);

$$("[data-template]").forEach(button => {
  button.addEventListener("click", () => {
    const type = button.dataset.template;

    const names = {
      note: "Schnelle Notiz",
      project: "Neues Projekt",
      tasks: "Meine Aufgaben"
    };

    openNewPageModal(type);

    if (elements.newPageTitle) {
      elements.newPageTitle.value = names[type] || "";
      elements.newPageTitle.select();
    }
  });
});

/* ----------------------------- Design / Dark Mode ----------------------------- */

function applyTheme(theme) {
  const dark = theme === "dark";

  document.body.classList.toggle("dark-mode", dark);

  if (elements.themeLabel) {
    elements.themeLabel.textContent =
      dark ? "Helles Design" : "Dunkles Design";
  }

  if (elements.themeIcon) {
    elements.themeIcon.textContent = dark ? "☀" : "◐";
  }

  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch (error) {
    console.warn("Design-Einstellung konnte nicht gespeichert werden.", error);
  }
}

function initializeTheme() {
  try {
    applyTheme(
      localStorage.getItem(THEME_KEY) === "dark"
        ? "dark"
        : "light"
    );
  } catch {
    applyTheme("light");
  }
}

on("#themeButton", "click", () => {
  applyTheme(
    document.body.classList.contains("dark-mode")
      ? "light"
      : "dark"
  );
});

/* ----------------------------- Markdown-Export ----------------------------- */

function exportPageAsMarkdown(page) {
  const doc = new DOMParser().parseFromString(
    page.content || "",
    "text/html"
  );

  function convert(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    if (node.dataset?.nexusBlock === "true") {
      return Array.from(node.childNodes)
        .map(convert)
        .join("")
        .trim() + "\n\n";
    }

    const tag = node.tagName.toLowerCase();

    const inner = Array.from(node.childNodes)
      .map(convert)
      .join("");

    if (tag === "h1") return `# ${inner}\n\n`;
    if (tag === "h2") return `## ${inner}\n\n`;
    if (tag === "h3") return `### ${inner}\n\n`;

    if (["strong", "b"].includes(tag)) {
      return `**${inner}**`;
    }

    if (["em", "i"].includes(tag)) {
      return `*${inner}*`;
    }

    if (tag === "a") {
      return `[${inner}](${node.getAttribute("href") || ""})`;
    }

    if (tag === "li") {
      return `- ${inner.trim()}\n`;
    }

    if (["ul", "ol"].includes(tag)) {
      return `${inner}\n`;
    }

    if (tag === "blockquote") {
      return `> ${inner.trim()}\n\n`;
    }

    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n\n";

    if (tag === "input" && node.type === "checkbox") {
      return node.checked ? "[x] " : "[ ] ";
    }

    if (["p", "div"].includes(tag)) {
      return `${inner}\n\n`;
    }

    return inner;
  }

  const body = [...doc.body.childNodes]
    .map(convert)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `# ${page.title || "Unbenannte Seite"}\n\n${body}\n`;
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

on("#exportButton", "click", () => {
  const page = getActivePage();

  if (state.view === "editor" && page) {
    const filename = (page.title || "notiz")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .trim() || "notiz";

    downloadText(
      `${filename}.md`,
      exportPageAsMarkdown(page),
      "text/markdown;charset=utf-8"
    );

    toast("Seite als Markdown exportiert");
    return;
  }

  downloadText(
    "nexus-backup.json",
    JSON.stringify({
      app: "Nexus Workspace",
      version: 2,
      exportedAt: new Date().toISOString(),
      pages: state.pages
    }, null, 2),
    "application/json;charset=utf-8"
  );

  toast("Workspace-Backup exportiert");
});

/* ----------------------------- Editor-Ereignisse ----------------------------- */

elements.pageTitle?.addEventListener("input", saveEditor);

elements.pageContent?.addEventListener("input", () => {
  if (!composing) saveEditor();
});

elements.pageContent?.addEventListener("compositionstart", () => {
  composing = true;
});

elements.pageContent?.addEventListener("compositionend", () => {
  composing = false;
  saveEditor();
});

elements.pageContent?.addEventListener("change", event => {
  if (event.target.matches('input[type="checkbox"]')) {
    saveEditor();
  }
});

/* ----------------------------- Mobile Navigation ----------------------------- */

on("#menuButton", "click", openSidebar);
on("#closeSidebar", "click", closeSidebar);

elements.sidebarOverlay?.addEventListener("click", closeSidebar);

/* ----------------------------- Tastenkürzel ----------------------------- */

document.addEventListener("keydown", event => {
  const modifier = event.ctrlKey || event.metaKey;

  if (event.key === "Escape") {
    if (
      elements.pageModal &&
      !elements.pageModal.classList.contains("hidden")
    ) {
      closeNewPageModal();
    } else {
      closeSidebar();
      closeBlockMenu();
    }
  }

  if (modifier && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }

  if (modifier && event.key.toLowerCase() === "s") {
    event.preventDefault();

    if (state.view === "editor") {
      saveEditor();
      persistImmediately();
      toast("Gespeichert");
    }
  }

  if (modifier && event.key.toLowerCase() === "n") {
    event.preventDefault();
    openNewPageModal();
  }

  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) &&
    !document.activeElement?.isContentEditable
  ) {
    event.preventDefault();
    openSearch();
  }
});

/* ----------------------------- Anwendung starten ----------------------------- */

function initializeApp() {
  loadState();
  initializeTheme();
  renderAll();

  if (state.activePageId && getActivePage()) {
    openPage(state.activePageId);
  } else {
    setView("dashboard");
  }
}

initializeApp();