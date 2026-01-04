// State
const state = {
  currentTab: "schema",
  schema: null,
  functions: null,
  relationships: null,
  selectedItem: null,
};

// DOM Elements
const sidebar = document.getElementById("sidebar-content");
const mainContent = document.getElementById("main-content");
const infoEl = document.getElementById("info");
const tabs = document.querySelectorAll(".tab");

// Initialize
async function init() {
  // Load data
  const [schemaRes, functionsRes, relationshipsRes, infoRes] = await Promise.all([
    fetch("/api/schema").then((r) => r.json()),
    fetch("/api/functions").then((r) => r.json()),
    fetch("/api/relationships").then((r) => r.json()),
    fetch("/api/info").then((r) => r.json()),
  ]);

  state.schema = schemaRes;
  state.functions = functionsRes;
  state.relationships = relationshipsRes;

  // Update info
  infoEl.textContent = `${infoRes.tableCount} tables, ${infoRes.functionCount} functions`;

  // Set up tab listeners
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Render initial view
  renderSidebar();
}

function switchTab(tab) {
  state.currentTab = tab;
  state.selectedItem = null;

  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  renderSidebar();
  mainContent.innerHTML = '<div class="empty-state">Select an item from the sidebar</div>';
}

function renderSidebar() {
  if (state.currentTab === "schema") {
    renderSchemaSidebar();
  } else {
    renderFunctionsSidebar();
  }
}

function renderSchemaSidebar() {
  const tables = state.schema?.tables || [];
  const relationships = state.relationships?.relationships || [];

  let html = '<div class="sidebar-section">';
  html += "<h3>Tables</h3>";

  for (const table of tables) {
    const isActive = state.selectedItem === table.name;
    html += `
      <div class="sidebar-item ${isActive ? "active" : ""}" onclick="selectTable('${table.name}')">
        <span class="name">${table.name}</span>
        <span class="badge">${table.columns.length} cols</span>
      </div>
    `;
  }

  html += "</div>";

  // Relationships section
  if (relationships.length > 0) {
    html += '<div class="sidebar-section">';
    html += "<h3>Relationships</h3>";

    const groupedRels = {};
    for (const rel of relationships) {
      if (!groupedRels[rel.fromTable]) groupedRels[rel.fromTable] = [];
      groupedRels[rel.fromTable].push(rel);
    }

    for (const [table, rels] of Object.entries(groupedRels)) {
      html += `<div class="sidebar-item" style="cursor: default;">`;
      html += `<span class="name">${table}</span>`;
      html += `<span class="badge">${rels.length}</span>`;
      html += "</div>";
    }

    html += "</div>";
  }

  sidebar.innerHTML = html;
}

function renderFunctionsSidebar() {
  const functions = state.functions?.functions?.filter((f) => f.isExported) || [];

  let html = '<div class="sidebar-section">';
  html += "<h3>Functions</h3>";

  for (const func of functions) {
    const isActive = state.selectedItem === func.name;
    html += `
      <div class="sidebar-item ${isActive ? "active" : ""}" onclick="selectFunction('${func.name}')">
        <span class="name">${func.name}</span>
        <span class="badge">${func.sqlQueries.length} SQL</span>
      </div>
    `;
  }

  html += "</div>";
  sidebar.innerHTML = html;
}

function selectTable(name) {
  state.selectedItem = name;
  renderSidebar();

  const table = state.schema?.tables?.find((t) => t.name === name);
  if (!table) return;

  const relationships =
    state.relationships?.relationships?.filter((r) => r.fromTable === name || r.toTable === name) ||
    [];

  let html = `
    <div class="content-header">
      <h2>${table.name}</h2>
      <div class="subtitle">${table.columns.length} columns, ${table.indexes.length} indexes</div>
    </div>
  `;

  // Columns table
  html += '<div class="section">';
  html += '<div class="section-title">Columns</div>';
  html += `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Nullable</th>
          <th>Default</th>
          <th>Constraints</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const col of table.columns) {
    const constraints = [];
    if (col.isPrimaryKey) constraints.push('<span class="tag tag-primary">PK</span>');
    if (col.isAutoIncrement) constraints.push('<span class="tag tag-muted">AUTO</span>');

    html += `
      <tr>
        <td><strong>${col.name}</strong></td>
        <td><span class="tag tag-success">${col.type}</span></td>
        <td>${col.nullable ? '<span class="tag tag-muted">NULL</span>' : '<span class="tag tag-warning">NOT NULL</span>'}</td>
        <td>${col.defaultValue ? `<code>${escapeHtml(col.defaultValue)}</code>` : "-"}</td>
        <td>${constraints.join(" ") || "-"}</td>
      </tr>
    `;
  }

  html += "</tbody></table></div>";

  // Foreign Keys
  if (table.foreignKeys.length > 0) {
    html += '<div class="section">';
    html += '<div class="section-title">Foreign Keys</div>';

    for (const fk of table.foreignKeys) {
      html += `
        <div class="relationship">
          <span class="column-name">${fk.column}</span>
          <span class="arrow">-></span>
          <span class="table-name">${fk.referencesTable}</span>.<span class="column-name">${fk.referencesColumn}</span>
          ${fk.onDelete ? `<span class="tag tag-muted">ON DELETE ${fk.onDelete}</span>` : ""}
        </div>
      `;
    }

    html += "</div>";
  }

  // Indexes
  if (table.indexes.length > 0) {
    html += '<div class="section">';
    html += '<div class="section-title">Indexes</div>';

    for (const idx of table.indexes) {
      html += `
        <div class="relationship">
          <strong>${idx.name}</strong>
          ${idx.isUnique ? '<span class="tag tag-primary">UNIQUE</span>' : ""}
          <span class="column-name">(${idx.columns.join(", ")})</span>
        </div>
      `;
    }

    html += "</div>";
  }

  // Incoming relationships
  const incomingRels = relationships.filter((r) => r.toTable === name);
  if (incomingRels.length > 0) {
    html += '<div class="section">';
    html += '<div class="section-title">Referenced By</div>';

    for (const rel of incomingRels) {
      html += `
        <div class="relationship">
          <span class="table-name">${rel.fromTable}</span>.<span class="column-name">${rel.fromColumn}</span>
          <span class="arrow">-></span>
          <span class="column-name">${rel.toColumn}</span>
        </div>
      `;
    }

    html += "</div>";
  }

  mainContent.innerHTML = html;
}

function selectFunction(name) {
  state.selectedItem = name;
  renderSidebar();

  const func = state.functions?.functions?.find((f) => f.name === name);
  if (!func) return;

  // Build signature
  const params = func.params
    .map(
      (p) =>
        `<span class="param-name">${p.name}</span>: <span class="param-type">${escapeHtml(p.type)}</span>`
    )
    .join(", ");
  const signature = `${func.name}(${params}): <span class="return-type">${escapeHtml(func.returnType)}</span>`;

  let html = `
    <div class="content-header">
      <h2>${func.name}</h2>
      ${func.description ? `<div class="subtitle">${escapeHtml(func.description)}</div>` : ""}
    </div>
  `;

  // Signature
  html += '<div class="section">';
  html += '<div class="section-title">Signature</div>';
  html += `<div class="function-signature">${signature}</div>`;
  html += "</div>";

  // Tables used
  if (func.tablesUsed.length > 0) {
    html += '<div class="section">';
    html += '<div class="section-title">Tables Used</div>';
    html += '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">';
    for (const table of func.tablesUsed) {
      html += `<span class="tag tag-primary">${table}</span>`;
    }
    html += "</div></div>";
  }

  // SQL Queries
  if (func.sqlQueries.length > 0) {
    html += '<div class="section">';
    html += '<div class="section-title">SQL Queries</div>';

    for (const query of func.sqlQueries) {
      html += `
        <div style="margin-bottom: 1rem;">
          <span class="tag tag-${getQueryTypeClass(query.type)}" style="margin-bottom: 0.5rem; display: inline-block;">${query.type}</span>
          <div class="code-block">${escapeHtml(query.sql)}</div>
        </div>
      `;
    }

    html += "</div>";
  }

  mainContent.innerHTML = html;
}

function getQueryTypeClass(type) {
  switch (type) {
    case "SELECT":
      return "success";
    case "INSERT":
      return "primary";
    case "UPDATE":
      return "warning";
    case "DELETE":
      return "muted";
    default:
      return "muted";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Expose functions to global scope for onclick handlers
window.selectTable = selectTable;
window.selectFunction = selectFunction;

// Start the app
init();
