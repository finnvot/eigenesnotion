
/* =========================================
   NEXUS WORKSPACE — APPLICATION
   ========================================= */

"use strict";

const STORAGE_KEY = "nexus-workspace-v1";
const THEME_KEY = "nexus-workspace-theme-v1";

const $ = (selector) => document.querySelector(selector);

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

const viewElements = [
  elements.dashboard,
  elements.allPagesView,
  elements.editorView,
  elements.searchView
];

let state = {
  pages: [],
  activePageId: null,
  view: "dashboard"
};

let saveTimer = null;
let toastTimer = null;
let isComposing = false;

/* -----------------------------------------
   HELPERS
   ----------------------------------------- */

function createId() {
  if (typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "page-" + Date.now() + "-" +
    Math.random().toString(36).slice(2, 10);
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
    String(html || ""), "text/html"
  );
  return (doc.body.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
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

  const today = new Date();
  const date = new Date(timestamp);

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

function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
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
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

/* -----------------------------------------
   PAGE TEMPLATES
   ----------------------------------------- */

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

/* -----------------------------------------
   INITIAL DATA
   ----------------------------------------- */

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
          <li>Erstelle über <strong>+ Neu</strong> eine eigene Seite.</li>
          <li>Bearbeite Texte direkt im Editor.</li>
          <li>Markiere wichtige Seiten als Favoriten.</li>
          <li>Nutze die Suche, um Inhalte schnell wiederzufinden.</li>
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

/* -----------------------------------------
   LOAD AND SAVE
   ----------------------------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      state.pages = createStarterPages();
      persistImmediately();
      return;
    }

    const saved = JSON.parse(raw);

    if (!saved || !Array.isArray(saved.pages)) {
      throw new Error("Ungültige gespeicherte Daten");
    }

    const ids = new Set();

    state.pages = saved.pages
      .filter(page =>
        page &&
        typeof page.id === "string" &&
        !ids.has(page.id) &&
        typeof page.title === "string"
      )
      .map(page => {
        ids.add(page.id);

        return {
          id: page.id,
          title: page.title.slice(0, 180),
          icon: typeof page.icon === "string"
            ? page.icon.slice(0, 10) : "📄",
          type: ["blank", "note", "project", "tasks"]
            .includes(page.type) ? page.type : "blank",
          parentId: typeof page.parentId === "string"
            ? page.parentId : null,
          favorite: Boolean(page.favorite),
          content: typeof page.content === "string"
            ? page.content : "",
          createdAt: Number(page.createdAt) || Date.now(),
          updatedAt: Number(page.updatedAt) || Date.now()
        };
      });

    // Ungültige Elternverweise entfernen.
    state.pages.forEach(page => {
      if (page.parentId &&
          (!ids.has(page.parentId) || page.parentId === page.id)) {
        page.parentId = null;
      }
    });

    // Verhindert zyklische Unterseiten-Beziehungen.
    state.pages.forEach(page => {
      const visited = new Set([page.id]);
      let parent = getPage(page.parentId);

      while (parent) {
        if (visited.has(parent.id)) {
          page.parentId = null;
          break;
        }

        visited.add(parent.id);
        parent = getPage(parent.parentId);
      }
    });

    state.activePageId = saved.activePageId || null;

    if (!getActivePage()) {
      state.activePageId = null;
    }
  } catch (error) {
    console.error("Nexus konnte die Daten nicht laden:", error);

    state.pages = createStarterPages();
    state.activePageId = null;

    toast("Die gespeicherten Daten konnten nicht gelesen werden.");
  }
}

function persistImmediately() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pages: state.pages,
      activePageId: state.activePageId
    }));

    elements.saveStatus.textContent = "Gespeichert";
    return true;
  } catch (error) {
    console.error("Speichern fehlgeschlagen:", error);

    elements.saveStatus.textContent = "Speicherfehler";
    toast("Speichern fehlgeschlagen. Prüfe deinen Browserspeicher.");
    return false;
  }
}

function saveState() {
  elements.saveStatus.textContent = "Speichert …";

  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    persistImmediately();
  }, 350);
}

/* -----------------------------------------
   NAVIGATION
   ----------------------------------------- */

function setView(view) {
  state.view = view;

  viewElements.forEach(element => element.classList.add("hidden"));

  const activeViews = {
    dashboard: elements.dashboard,
    allPages: elements.allPagesView,
    editor: elements.editorView,
    search: elements.searchView
  };

  const activeElement = activeViews[view];

  if (activeElement) {
    activeElement.classList.remove("hidden");
  }

  document.querySelectorAll(".sidebar-actions .nav-item")
    .forEach(button => button.classList.remove("active"));

  if (view === "dashboard") {
    $("#homeButton").classList.add("active");
  }

  if (view === "allPages") {
    $("#allPagesButton").classList.add("active");
  }

  if (view === "search") {
    $("#searchButton").classList.add("active");
  }

  renderBreadcrumbs();
  closeSidebar();
}

function renderBreadcrumbs() {
  const page = getActivePage();

  if (state.view === "editor" && page) {
    const chain = [];
    let current = page;
    const seen = new Set();

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current);
      current = getPage(current.parentId);
    }

    elements.breadcrumbs.replaceChildren();

    const root = document.createElement("span");
    root.textContent = "Nexus";
    elements.breadcrumbs.append(root);

    chain.forEach(item => {
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.textContent = "/";
      elements.breadcrumbs.append(separator);

      const title = document.createElement("span");
      title.textContent = item.title || "Unbenannte Seite";
      elements.breadcrumbs.append(title);
    });

    return;
  }

  const labels = {
    dashboard: "Startseite",
    allPages: "Alle Seiten",
    search: "Suche"
  };

  elements.breadcrumbs.innerHTML = "";

  const root = document.createElement("span");
  root.textContent = "Nexus";

  const separator = document.createElement("span");
  separator.className = "breadcrumb-separator";
  separator.textContent = "/";

  const label = document.createElement("span");
  label.textContent = labels[state.view] || "Startseite";

  elements.breadcrumbs.append(root, separator, label);
}

function openPage(id) {
  const page = getPage(id);
  if (!page) return;

  state.activePageId = page.id;
  page.updatedAt = Date.now();

  elements.pageTitle.value = page.title;
  elements.pageContent.innerHTML = page.content;
  elements.editorIcon.textContent = page.icon || "📄";
  elements.editorDate.textContent = formatDate(page.updatedAt);

  updateWordCount();
  updateFavoriteButton();
  renderSidebar();
  renderSubpages();
  renderBreadcrumbs();

  setView("editor");
  saveState();

  elements.pageTitle.blur();
}

function goHome() {
  state.activePageId = null;
  setView("dashboard");
  renderAll();
  saveState();
}

function openSearch() {
  setView("search");
  renderSearch(elements.searchInput.value);
  elements.searchInput.focus();
}

function openAllPages() {
  setView("allPages");
  renderAllPages();
}

function openSidebar() {
  elements.sidebar.classList.add("open");
  elements.sidebarOverlay.classList.add("active");
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.sidebarOverlay.classList.remove("active");
}

/* -----------------------------------------
   SIDEBAR AND PAGE TREE
   ----------------------------------------- */

function renderSidebar() {
  elements.pageTree.replaceChildren();
  elements.favoriteList.replaceChildren();

  const roots = getRootPages();

  if (!roots.length) {
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = "Noch keine Seiten. Erstelle deine erste!";
    elements.pageTree.append(empty);
  }

  roots.forEach(page => {
    renderTreeItem(page, elements.pageTree, 0);
  });

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
      const item = createTreeElement(page, 0);
      elements.favoriteList.append(item);
    });
  }
}

function renderTreeItem(page, container, depth) {
  if (depth > 20) return;

  container.append(createTreeElement(page, depth));

  getChildren(page.id).forEach(child => {
    renderTreeItem(child, container, depth + 1);
  });
}

function createTreeElement(page, depth) {
  const item = document.createElement("div");

  item.className = "tree-item";
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.style.paddingLeft = (7 + Math.min(depth, 5) * 12) + "px";

  if (page.id === state.activePageId &&
      state.view === "editor") {
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
    const favorite = document.createElement("span");
    favorite.className = "tree-fav";
    favorite.textContent = "★";
    item.append(favorite);
  }

  const hasChildren = getChildren(page.id).length > 0;

  if (hasChildren) {
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

/* -----------------------------------------
   DASHBOARD AND CARDS
   ----------------------------------------- */

function createPageCard(page) {
  const card = document.createElement("article");
  card.className = "page-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", "Seite öffnen: " + page.title);

  const top = document.createElement("div");
  top.className = "page-card-top";

  const icon = document.createElement("span");
  icon.className = "page-card-icon";
  icon.textContent = page.icon || "📄";

  top.append(icon);

  if (page.favorite) {
    const favorite = document.createElement("span");
    favorite.className = "page-card-fav";
    favorite.textContent = "★";
    top.append(favorite);
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

function createEmptyState(title, description, buttonText, action) {
  const box = document.createElement("div");
  box.className = "empty-state";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = description;

  box.append(heading, paragraph);

  if (buttonText && typeof action === "function") {
    const button = document.createElement("button");
    button.className = "primary-btn";
    button.textContent = buttonText;
    button.addEventListener("click", action);
    box.append(button);
  }

  return box;
}

function renderDashboard() {
  const pages = [...state.pages]
    .sort((a, b) => b.updatedAt - a.updatedAt);

  elements.pageCount.textContent = state.pages.length;
  elements.favoriteCount.textContent =
    state.pages.filter(page => page.favorite).length;

  elements.lastActivity.textContent = pages.length
    ? relativeDate(pages[0].updatedAt)
    : "Noch nichts";

  elements.recentPages.replaceChildren();

  if (!pages.length) {
    elements.recentPages.append(
      createEmptyState(
        "Dein Workspace ist noch leer.",
        "Erstelle deine erste Seite und beginne mit dem Sammeln deiner Ideen.",
        "Erste Seite erstellen",
        () => openNewPageModal()
      )
    );
  } else {
    pages.slice(0, 3).forEach(page => {
      elements.recentPages.append(createPageCard(page));
    });
  }
}

function renderAllPages() {
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

/* -----------------------------------------
   CREATE PAGES AND SUBPAGES
   ----------------------------------------- */

function openNewPageModal(type = "blank", parentId = null) {
  elements.pageForm.reset();
  elements.newPageType.value = type;

  const parent = getPage(parentId);
  elements.newPageTitle.value = "";

  if (parent) {
    elements.newPageTitle.placeholder =
      "Unterseite von " + parent.title;
  } else {
    elements.newPageTitle.placeholder = "z. B. Meine Ideen";
  }

  elements.pageModal.dataset.parentId = parentId || "";
  elements.pageModal.classList.remove("hidden");

  requestAnimationFrame(() => elements.newPageTitle.focus());
}

function closeNewPageModal() {
  elements.pageModal.classList.add("hidden");
  elements.pageModal.dataset.parentId = "";
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

  saveState();
  renderAll();
  openPage(page.id);

  toast("Seite erstellt");
}

elements.pageForm.addEventListener("submit", event => {
  event.preventDefault();

  const title = elements.newPageTitle.value.trim();
  const type = elements.newPageType.value;
  const parentId = elements.pageModal.dataset.parentId || null;

  if (!title) {
    elements.newPageTitle.focus();
    return;
  }

  closeNewPageModal();
  createPage(title, type, parentId);
});

$("#newPageButton").addEventListener("click", () => {
  openNewPageModal();
});

$("#topNewPageButton").addEventListener("click", () => {
  openNewPageModal();
});

$("#heroNewPage").addEventListener("click", () => {
  openNewPageModal();
});

$("#closeModal").addEventListener("click", closeNewPageModal);
$("#cancelModal").addEventListener("click", closeNewPageModal);

elements.pageModal.addEventListener("click", event => {
  if (event.target === elements.pageModal) {
    closeNewPageModal();
  }
});

$("#addSubpageButton").addEventListener("click", () => {
  const page = getActivePage();

  if (!page) return;

  openNewPageModal("blank", page.id);
});

function renderSubpages() {
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

/* -----------------------------------------
   EDITOR AND AUTOSAVE
   ----------------------------------------- */

function updateWordCount() {
  const page = getActivePage();

  if (!page) {
    elements.wordCount.textContent = "0 Wörter";
    return;
  }

  const title = elements.pageTitle.value;
  const content = plainText(elements.pageContent.innerHTML);
  const count = countWords(title + " " + content);

  elements.wordCount.textContent =
    count + (count === 1 ? " Wort" : " Wörter");
}

function saveEditor() {
  const page = getActivePage();
  if (!page) return;

  page.title = elements.pageTitle.value.trim().slice(0, 180);
  page.content = elements.pageContent.innerHTML;
  page.updatedAt = Date.now();

  elements.editorDate.textContent = formatDate(page.updatedAt);

  updateWordCount();
  renderSidebar();
  renderDashboard();
  renderAllPages();
  renderSubpages();
  renderBreadcrumbs();
  saveState();
}

elements.pageTitle.addEventListener("input", () => {
  saveEditor();
});

elements.pageContent.addEventListener("input", () => {
  if (!isComposing) saveEditor();
});

elements.pageContent.addEventListener("compositionstart", () => {
  isComposing = true;
});

elements.pageContent.addEventListener("compositionend", () => {
  isComposing = false;
  saveEditor();
});

elements.pageContent.addEventListener("change", event => {
  if (event.target.matches('input[type="checkbox"]')) {
    saveEditor();
  }
});

/* -----------------------------------------
   RICH TEXT TOOLBAR
   ----------------------------------------- */

function runEditorCommand(command, value = null) {
  elements.pageContent.focus();

  document.execCommand(command, false, value);

  saveEditor();
}

document.querySelectorAll("[data-command]").forEach(button => {
  button.addEventListener("mousedown", event => {
    // Verhindert, dass die Textauswahl beim Klicken verloren geht.
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    runEditorCommand(button.dataset.command);
  });
});

document.querySelectorAll("[data-block]").forEach(button => {
  button.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    const block = button.dataset.block;

    if (block === "blockquote") {
      runEditorCommand("formatBlock", "BLOCKQUOTE");
    } else {
      runEditorCommand("formatBlock", block.toUpperCase());
    }
  });
});

$("#checklistButton").addEventListener("mousedown", event => {
  event.preventDefault();
});

$("#checklistButton").addEventListener("click", () => {
  elements.pageContent.focus();

  const selection = window.getSelection();
  const selectedText = selection ? selection.toString() : "";

  const row = document.createElement("div");
  row.className = "check-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";

  const text = document.createElement("span");
  text.textContent = selectedText || "Neue Aufgabe";

  row.append(checkbox, text);

  const range = selection && selection.rangeCount
    ? selection.getRangeAt(0) : null;

  if (range && elements.pageContent.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(row);
  } else {
    elements.pageContent.append(row);
  }

  const spacer = document.createElement("p");
  spacer.innerHTML = "<br>";
  row.after(spacer);

  const nextRange = document.createRange();
  nextRange.selectNodeContents(spacer);
  nextRange.collapse(true);

  if (selection) {
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }

  saveEditor();
});

$("#linkButton").addEventListener("mousedown", event => {
  event.preventDefault();
});

$("#linkButton").addEventListener("click", () => {
  const rawUrl = prompt("Welche Webadresse soll verlinkt werden?");

  if (!rawUrl) return;

  const trimmed = rawUrl.trim();

  let url;

  try {
    url = new URL(
      /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
        ? trimmed
        : "https://" + trimmed
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

  // Öffnet Links in einem neuen Tab und schützt vor Zugriff
  // auf das Fenster der Anwendung.
  elements.pageContent.querySelectorAll("a").forEach(link => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  saveEditor();
});

$("#clearFormatButton").addEventListener("mousedown", event => {
  event.preventDefault();
});

$("#clearFormatButton").addEventListener("click", () => {
  elements.pageContent.focus();
  document.execCommand("removeFormat", false, null);
  document.execCommand("formatBlock", false, "P");
  saveEditor();
});

function updateFavoriteButton() {
  const page = getActivePage();
  const active = Boolean(page && page.favorite);

  elements.favoriteButton.classList.toggle("is-favorite", active);
  elements.favoriteButton.textContent = active ? "★" : "☆";
  elements.favoriteButton.title = active
    ? "Aus Favoriten entfernen"
    : "Zu Favoriten hinzufügen";
}

elements.favoriteButton.addEventListener("click", () => {
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

  toast(page.favorite
    ? "Zu Favoriten hinzugefügt"
    : "Aus Favoriten entfernt");
});

/* -----------------------------------------
   DELETE PAGES
   ----------------------------------------- */

function collectDescendantIds(id, result = new Set()) {
  getChildren(id).forEach(child => {
    if (result.has(child.id)) return;

    result.add(child.id);
    collectDescendantIds(child.id, result);
  });

  return result;
}

$("#deletePageButton").addEventListener("click", () => {
  const page = getActivePage();
  if (!page) return;

  const descendants = collectDescendantIds(page.id);
  const total = descendants.size + 1;

  const message = total > 1
    ? `„${page.title}“ und ${descendants.size} Unterseite(n) löschen?`
    : `„${page.title}“ wirklich löschen?`;

  if (!confirm(message + "\n\nDiese Aktion kann nicht rückgängig gemacht werden.")) {
    return;
  }

  const idsToDelete = new Set([page.id, ...descendants]);

  state.pages = state.pages.filter(item => !idsToDelete.has(item.id));
  state.activePageId = null;

  saveState();
  renderAll();
  goHome();

  toast(total > 1
    ? "Seite und Unterseiten gelöscht"
    : "Seite gelöscht");
});

/* -----------------------------------------
   SEARCH
   ----------------------------------------- */

function renderSearch(query) {
  elements.searchResults.replaceChildren();

  const normalized = query.trim().toLocaleLowerCase("de");

  if (!normalized) {
    elements.searchResults.append(
      createEmptyState(
        "Was suchst du?",
        "Gib einen Titel oder ein Stichwort ein. Auch Seiteninhalte werden durchsucht.",
        null,
        null
      )
    );
    return;
  }

  const matches = state.pages.filter(page => {
    const searchable = (
      page.title + " " + plainText(page.content)
    ).toLocaleLowerCase("de");

    return searchable.includes(normalized);
  }).sort((a, b) => b.updatedAt - a.updatedAt);

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
    arrow.style.color = "var(--text-3)";

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

elements.searchInput.addEventListener("input", event => {
  renderSearch(event.target.value);
});

$("#searchButton").addEventListener("click", openSearch);

$("#homeButton").addEventListener("click", goHome);

$("#allPagesButton").addEventListener("click", openAllPages);

$("#viewAllButton").addEventListener("click", openAllPages);

/* -----------------------------------------
   QUICK TEMPLATES
   ----------------------------------------- */

document.querySelectorAll("[data-template]").forEach(button => {
  button.addEventListener("click", () => {
    const type = button.dataset.template;

    const names = {
      note: "Schnelle Notiz",
      project: "Neues Projekt",
      tasks: "Meine Aufgaben"
    };

    openNewPageModal(type);
    elements.newPageTitle.value = names[type] || "";
    elements.newPageTitle.select();
  });
});

/* -----------------------------------------
   THEME
   ----------------------------------------- */

function applyTheme(theme) {
  const dark = theme === "dark";

  document.body.classList.toggle("dark-mode", dark);

  elements.themeLabel.textContent = dark
    ? "Helles Design"
    : "Dunkles Design";

  elements.themeIcon.textContent = dark ? "☀" : "◐";

  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch (error) {
    console.warn("Design-Einstellung konnte nicht gespeichert werden.");
  }
}

function initializeTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    applyTheme(theme === "dark" ? "dark" : "light");
  } catch {
    applyTheme("light");
  }
}

elements.themeButton.addEventListener("click", () => {
  const dark = document.body.classList.contains("dark-mode");
  applyTheme(dark ? "light" : "dark");
});

/* -----------------------------------------
   EXPORT
   ----------------------------------------- */

function exportPageAsMarkdown(page) {
  const content = page.content || "";

  const doc = new DOMParser().parseFromString(
    content, "text/html"
  );

  function convertNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes)
      .map(convertNode).join("");

    if (tag === "h1") return "# " + inner + "\n\n";
    if (tag === "h2") return "## " + inner + "\n\n";
    if (tag === "h3") return "### " + inner + "\n\n";
    if (tag === "strong" || tag === "b") return "**" + inner + "**";
    if (tag === "em" || tag === "i") return "*" + inner + "*";
    if (tag === "u") return inner;
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      return "[" + inner + "](" + href + ")";
    }

    if (tag === "li") return "- " + inner.trim() + "\n";
    if (tag === "ul" || tag === "ol") return inner + "\n";
    if (tag === "blockquote") return "> " + inner.trim() + "\n\n";
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n\n";
    if (tag === "p" || tag === "div") return inner + "\n\n";

    if (tag === "input" && node.type === "checkbox") {
      return node.checked ? "[x] " : "[ ] ";
    }

    return inner;
  }

  const body = Array.from(doc.body.childNodes)
    .map(convertNode).join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return "# " + (page.title || "Unbenannte Seite") +
    "\n\n" + body + "\n";
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

$("#exportButton").addEventListener("click", () => {
  const page = getActivePage();

  if (state.view === "editor" && page) {
    const markdown = exportPageAsMarkdown(page);
    const filename = (page.title || "notiz")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .trim() || "notiz";

    downloadText(
      filename + ".md",
      markdown,
      "text/markdown;charset=utf-8"
    );

    toast("Seite als Markdown exportiert");
    return;
  }

  const backup = JSON.stringify({
    app: "Nexus Workspace",
    version: 1,
    exportedAt: new Date().toISOString(),
    pages: state.pages
  }, null, 2);

  downloadText(
    "nexus-backup.json",
    backup,
    "application/json;charset=utf-8"
  );

  toast("Workspace-Backup exportiert");
});

/* -----------------------------------------
   KEYBOARD SHORTCUTS
   ----------------------------------------- */

document.addEventListener("keydown", event => {
  const modifier = event.ctrlKey || event.metaKey;

  if (event.key === "Escape") {
    if (!elements.pageModal.classList.contains("hidden")) {
      closeNewPageModal();
    } else {
      closeSidebar();
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

  if (event.key === "/" &&
      !["INPUT", "TEXTAREA"].includes(
        document.activeElement.tagName
      ) &&
      !document.activeElement.isContentEditable) {
    event.preventDefault();
    openSearch();
  }
});

/* =========================================
   NEXUS 2.0 — BLOCK EDITOR + BREADCRUMBS
   Diesen Abschnitt ans Ende von script.js setzen.
   ========================================= */

let blockInsertAfter = null;
let draggedBlock = null;
let lastBlockFocus = null;

/* -----------------------------------------
   BREADCRUMBS: JETZT ANKLICKBAR
   ----------------------------------------- */

function renderBreadcrumbs() {
  const page = getActivePage();
  elements.breadcrumbs.replaceChildren();

  function addCrumb(label, callback, isCurrent = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "breadcrumb-link";
    button.textContent = label;
    button.style.cssText = `
      padding: 5px 2px;
      color: ${isCurrent ? "var(--text)" : "var(--text-2)"};
      background: transparent;
      border: 0;
      border-radius: 4px;
      font: inherit;
      cursor: ${isCurrent ? "default" : "pointer"};
      text-align: left;
    `;

    if (!isCurrent) {
      button.addEventListener("click", callback);
      button.addEventListener("mouseenter", () => {
        button.style.color = "var(--accent)";
      });
      button.addEventListener("mouseleave", () => {
        button.style.color = "var(--text-2)";
      });
    }

    elements.breadcrumbs.append(button);
  }

  function addSeparator() {
    const separator = document.createElement("span");
    separator.className = "breadcrumb-separator";
    separator.textContent = "/";
    elements.breadcrumbs.append(separator);
  }

  addCrumb("Nexus", () => goHome());

  if (state.view === "editor" && page) {
    const chain = [];
    let current = page;
    const visited = new Set();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.unshift(current);
      current = getPage(current.parentId);
    }

    chain.forEach((item, index) => {
      addSeparator();

      const isCurrent = index === chain.length - 1;

      addCrumb(
        item.title || "Unbenannte Seite",
        () => openPage(item.id),
        isCurrent
      );
    });

    return;
  }

  const labels = {
    dashboard: "Startseite",
    allPages: "Alle Seiten",
    search: "Suche"
  };

  addSeparator();
  addCrumb(labels[state.view] || "Startseite", () => {}, true);
}

/* -----------------------------------------
   BLOCK-EDITOR: BLOCK-TYPEN
   ----------------------------------------- */

function detectBlockType(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const node = doc.body.firstElementChild;

  if (!node) return "text";

  const tag = node.tagName.toLowerCase();

  if (tag === "h1") return "h1";
  if (tag === "h2") return "h2";
  if (tag === "h3") return "h2";
  if (tag === "blockquote") return "quote";
  if (tag === "hr") return "divider";
  if (tag === "ul" || tag === "ol") return "bullet";

  if (node.querySelector('.check-row, input[type="checkbox"]')) {
    return "todo";
  }

  return "text";
}

function normalizeBlockHTML(html, type) {
  if (type === "divider") return "<hr>";

  if (type === "todo") {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    const existing = doc.body.querySelector(".check-row");

    if (existing) return existing.outerHTML;

    const text = plainText(html);
    return `
      <div class="check-row">
        <input type="checkbox">
        <span>${escapeHTML(text || "Neue Aufgabe")}</span>
      </div>
    `;
  }

  if (type === "h1" || type === "h2") {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    const first = doc.body.firstElementChild;

    if (first && /^H[1-6]$/.test(first.tagName)) {
      return `<${type}>${first.innerHTML}</${type}>`;
    }

    return `<${type}>${doc.body.innerHTML || ""}</${type}>`;
  }

  if (type === "quote") {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    const first = doc.body.firstElementChild;

    if (first && first.tagName === "BLOCKQUOTE") {
      return first.outerHTML;
    }

    return `<blockquote>${doc.body.innerHTML || ""}</blockquote>`;
  }

  return html || "<p></p>";
}

/* -----------------------------------------
   ERSTELLUNG EINZELNER BLÖCKE
   ----------------------------------------- */

function createEditorBlock(type = "text", html = "") {
  const block = document.createElement("div");
  block.className = "editor-block";
  block.dataset.blockType = type;
  block.draggable = false;

  const controls = document.createElement("div");
  controls.className = "block-controls";

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "block-control drag-handle";
  handle.textContent = "⠿";
  handle.title = "Block verschieben";
  handle.setAttribute("aria-label", "Block verschieben");
  handle.draggable = true;

  const more = document.createElement("button");
  more.type = "button";
  more.className = "block-control";
  more.textContent = "+";
  more.title = "Block darunter einfügen";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "block-control delete-block";
  remove.textContent = "×";
  remove.title = "Block löschen";

  controls.append(handle, more, remove);

  const body = document.createElement("div");
  body.className = "block-body";

  const text = document.createElement("div");
  text.className = "block-text";
  text.contentEditable = "true";
  text.setAttribute("role", "textbox");
  text.setAttribute("aria-multiline", "true");
  text.dataset.placeholder = placeholderForBlock(type);

  if (type === "divider") {
    text.contentEditable = "false";
    text.innerHTML = "<hr>";
    text.setAttribute("aria-label", "Trennlinie");
  } else {
    text.innerHTML = normalizeBlockHTML(html, type);
  }

  body.append(text);
  block.append(controls, body);

  /* Fokus merken, damit neue Blöcke an der richtigen Stelle landen. */
  text.addEventListener("focus", () => {
    lastBlockFocus = block;
  });

  text.addEventListener("input", () => {
    blockInsertAfter = block;
    saveEditor();
  });

  text.addEventListener("keydown", handleBlockKeydown);

  text.addEventListener("paste", event => {
    event.preventDefault();

    const clipboard = event.clipboardData;
    const plain = clipboard ? clipboard.getData("text/plain") : "";

    // Als Klartext einfügen, damit fremde Formatierungen
    // und eingebettete Skripte nicht übernommen werden.
    document.execCommand("insertText", false, plain);
    saveEditor();
  });

  text.addEventListener("change", saveEditor);

  more.addEventListener("mousedown", event => event.preventDefault());
  more.addEventListener("click", () => {
    blockInsertAfter = block;
    openBlockMenu(more);
  });

  remove.addEventListener("click", () => {
    const canvas = elements.pageContent;
    const blocks = [...canvas.querySelectorAll(":scope > .editor-block")];

    if (blocks.length <= 1) {
      text.innerHTML = type === "divider" ? "<hr>" : "<p></p>";
      if (type !== "divider") text.focus();
    } else {
      const next = block.nextElementSibling;
      const previous = block.previousElementSibling;

      block.remove();

      const target = next || previous;
      const targetText = target?.querySelector(".block-text");

      if (targetText && targetText.contentEditable === "true") {
        targetText.focus();
      }
    }

    saveEditor();
  });

  handle.addEventListener("dragstart", event => {
    draggedBlock = block;
    block.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", block.dataset.blockType);
    }
  });

  handle.addEventListener("dragend", () => {
    if (draggedBlock) draggedBlock.classList.remove("is-dragging");

    elements.pageContent.querySelectorAll(".drop-before, .drop-after")
      .forEach(item => item.classList.remove("drop-before", "drop-after"));

    draggedBlock = null;
    saveEditor();
  });

  block.addEventListener("dragover", event => {
    if (!draggedBlock || draggedBlock === block) return;

    event.preventDefault();

    const rect = block.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;

    block.classList.toggle("drop-before", !after);
    block.classList.toggle("drop-after", after);
  });

  block.addEventListener("dragleave", event => {
    if (!block.contains(event.relatedTarget)) {
      block.classList.remove("drop-before", "drop-after");
    }
  });

  block.addEventListener("drop", event => {
    event.preventDefault();

    if (!draggedBlock || draggedBlock === block) return;

    const rect = block.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;

    if (after) {
      block.after(draggedBlock);
    } else {
      block.before(draggedBlock);
    }

    block.classList.remove("drop-before", "drop-after");
    saveEditor();
  });

  return block;
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

/* -----------------------------------------
   BESTEHENDE SEITEN IN BLÖCKE UMWANDELN
   ----------------------------------------- */

function renderBlockCanvas(html) {
  const canvas = elements.pageContent;
  canvas.replaceChildren();

  const doc = new DOMParser().parseFromString(
    html || "", "text/html"
  );

  const nodes = [...doc.body.childNodes].filter(node => {
    return node.nodeType === Node.ELEMENT_NODE ||
      (node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  });

  if (!nodes.length) {
    canvas.append(createEditorBlock("text", "<p></p>"));
    return;
  }

  nodes.forEach(node => {
    let nodeHTML;

    if (node.nodeType === Node.TEXT_NODE) {
      nodeHTML = `<p>${escapeHTML(node.textContent)}</p>`;
    } else {
      nodeHTML = node.outerHTML;
    }

    const type = detectBlockType(nodeHTML);
    canvas.append(createEditorBlock(type, nodeHTML));
  });
}

/* -----------------------------------------
   EDITOR-SPEICHERUNG
   ----------------------------------------- */

function getCanvasHTML() {
  return [...elements.pageContent.querySelectorAll(":scope > .editor-block")]
    .map(block => {
      const text = block.querySelector(".block-text");
      if (!text) return "";

      const type = block.dataset.blockType;

      if (type === "divider") return "<hr>";

      const doc = new DOMParser().parseFromString(
        text.innerHTML, "text/html"
      );

      // Editor-Steuerelemente gehören nicht in den Seiteninhalt.
      doc.body.querySelectorAll(
        ".block-controls, .editor-block, script, iframe, object, embed"
      ).forEach(node => node.remove());

      doc.body.querySelectorAll("*").forEach(node => {
        [...node.attributes].forEach(attribute => {
          const name = attribute.name.toLowerCase();
          const value = attribute.value.trim().toLowerCase();

          if (name.startsWith("on") ||
              ((name === "href" || name === "src") &&
               value.startsWith("javascript:"))) {
            node.removeAttribute(attribute.name);
          }
        });
      });

      return doc.body.innerHTML || "<p></p>";
    })
    .join("\n");
}

function saveEditor() {
  const page = getActivePage();
  if (!page) return;

  page.title = elements.pageTitle.value.trim().slice(0, 180);
  page.content = getCanvasHTML();
  page.updatedAt = Date.now();

  elements.editorDate.textContent = formatDate(page.updatedAt);

  updateWordCount();
  renderSidebar();
  renderDashboard();
  renderAllPages();
  renderSubpages();
  renderBreadcrumbs();
  saveState();
}

function updateWordCount() {
  const title = elements.pageTitle.value;
  const text = plainText(getCanvasHTML());
  const count = countWords(title + " " + text);

  elements.wordCount.textContent =
    count + (count === 1 ? " Wort" : " Wörter");
}

/* -----------------------------------------
   SEITEN ÖFFNEN
   ----------------------------------------- */

function openPage(id) {
  const page = getPage(id);
  if (!page) return;

  state.activePageId = page.id;
  page.updatedAt = Date.now();

  elements.pageTitle.value = page.title;
  elements.editorIcon.textContent = page.icon || "📄";
  elements.editorDate.textContent = formatDate(page.updatedAt);

  renderBlockCanvas(page.content);
  updateWordCount();
  updateFavoriteButton();
  renderSidebar();
  renderSubpages();
  renderBreadcrumbs();

  setView("editor");
  saveState();
}

/* -----------------------------------------
   BLOCK-MENÜ UND SLASH-BEFEHLE
   ----------------------------------------- */

function openBlockMenu(anchor) {
  const menu = $("#blockMenu");
  if (!menu) return;

  const rect = anchor.getBoundingClientRect();

  menu.style.left = Math.max(
    12,
    Math.min(rect.left, window.innerWidth - 312)
  ) + "px";

  menu.style.top = Math.min(
    rect.bottom + 5,
    window.innerHeight - 350
  ) + "px";

  menu.classList.remove("hidden");
}

function closeBlockMenu() {
  $("#blockMenu")?.classList.add("hidden");
}

function insertBlock(type, afterBlock = null) {
  const canvas = elements.pageContent;
  const block = createEditorBlock(type);

  if (afterBlock && afterBlock.parentElement === canvas) {
    afterBlock.after(block);
  } else {
    canvas.append(block);
  }

  blockInsertAfter = block;
  closeBlockMenu();

  saveEditor();

  const text = block.querySelector(".block-text");

  if (text && text.contentEditable === "true") {
    text.focus();

    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(text);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
  }
}

$("#addBlockButton")?.addEventListener("click", event => {
  blockInsertAfter = lastBlockFocus || null;
  openBlockMenu(event.currentTarget);
});

document.querySelectorAll("[data-new-block]").forEach(button => {
  button.addEventListener("click", () => {
    insertBlock(button.dataset.newBlock, blockInsertAfter);
  });
});

document.addEventListener("click", event => {
  const menu = $("#blockMenu");

  if (!menu || menu.classList.contains("hidden")) return;

  if (menu.contains(event.target) ||
      event.target.closest("#addBlockButton") ||
      event.target.closest(".block-control")) {
    return;
  }

  closeBlockMenu();
});

function handleBlockKeydown(event) {
  const text = event.currentTarget;
  const block = text.closest(".editor-block");

  if (!block) return;

  if (event.key === "/" && text.textContent.trim() === "") {
    event.preventDefault();
    blockInsertAfter = block;
    openBlockMenu(text);
    return;
  }

  if (event.key === "Enter" && !event.shiftKey) {
    const type = block.dataset.blockType;

    if (type === "divider") {
      event.preventDefault();
      insertBlock("text", block);
      return;
    }

    // In einer Checkliste erzeugt Enter eine weitere Aufgabe.
    if (type === "todo") {
      event.preventDefault();
      insertBlock("todo", block);
      return;
    }

    // In Überschriften wird Enter zu einem normalen Absatz.
    if (type === "h1" || type === "h2" || type === "quote") {
      event.preventDefault();
      insertBlock("text", block);
      return;
    }

    // In normalen Textblöcken bleibt Enter ein Zeilenumbruch.
    // Mit Shift+Enter kann ebenfalls eine neue Zeile entstehen.
  }

  if (event.key === "Backspace" && text.textContent.trim() === "") {
    const previous = block.previousElementSibling;
    const next = block.nextElementSibling;

    if (previous || next) {
      event.preventDefault();

      const target = previous || next;
      const targetText = target.querySelector(".block-text");

      block.remove();
      saveEditor();

      if (targetText && targetText.contentEditable === "true") {
        targetText.focus();
      }
    }
  }
}

/* -----------------------------------------
   CHECKLISTEN SPEICHERN
   ----------------------------------------- */

elements.pageContent.addEventListener("change", event => {
  if (event.target.matches('input[type="checkbox"]')) {
    saveEditor();
  }
});

/* -----------------------------------------
   INITIALISIERUNG ABSCHLIESSEN
   ----------------------------------------- */

renderAll();

if (state.activePageId && getActivePage()) {
  openPage(state.activePageId);
} else {
  goHome();
}


/* -----------------------------------------
   MOBILE NAVIGATION
   ----------------------------------------- */

$("#menuButton").addEventListener("click", openSidebar);
$("#closeSidebar").addEventListener("click", closeSidebar);

elements.sidebarOverlay.addEventListener("click", closeSidebar);

/* -----------------------------------------
   START APPLICATION
   ----------------------------------------- */

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
