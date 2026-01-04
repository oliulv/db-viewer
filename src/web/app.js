// State
const state = {
  currentTab: "schema",
  schema: null,
  functions: null,
  relationships: null,
  selectedItem: null,
  diagramMode: true, // Start with diagram view for schema
  tablePositions: {}, // Store draggable table positions
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
  renderSchemaDiagram();
}

function switchTab(tab) {
  state.currentTab = tab;
  state.selectedItem = null;

  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  renderSidebar();

  if (tab === "schema") {
    state.diagramMode = true;
    renderSchemaDiagram();
  } else {
    // Auto-select first function
    const functions = state.functions?.functions?.filter((f) => f.isExported) || [];
    if (functions.length > 0) {
      selectFunction(functions[0].name);
    } else {
      mainContent.innerHTML = '<div class="empty-state">No exported functions found</div>';
    }
  }
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

  let html = '<div class="sidebar-section">';
  html += "<h3>Tables</h3>";

  for (const table of tables) {
    const isActive = state.selectedItem === table.name && !state.diagramMode;
    html += `
      <div class="sidebar-item ${isActive ? "active" : ""}" onclick="selectTable('${table.name}')">
        <span class="name">${table.name}</span>
        <span class="badge">${table.columns.length} cols</span>
      </div>
    `;
  }

  html += "</div>";

  // View toggle
  html += '<div class="sidebar-section">';
  html += "<h3>View</h3>";
  html += `<div class="sidebar-item ${state.diagramMode ? "active" : ""}" onclick="showDiagram()">`;
  html += `<span class="name">Diagram</span>`;
  html += "</div>";
  html += "</div>";

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

function showDiagram() {
  state.diagramMode = true;
  state.selectedItem = null;
  renderSidebar();
  renderSchemaDiagram();
}

function renderSchemaDiagram() {
  const tables = state.schema?.tables || [];
  const relationships = state.relationships?.relationships || [];

  if (tables.length === 0) {
    mainContent.innerHTML = '<div class="empty-state">No tables found</div>';
    return;
  }

  // Initialize positions if not set
  if (Object.keys(state.tablePositions).length === 0) {
    initializeTablePositions(tables);
  }

  let html = `
    <div class="diagram-container" id="diagram-container">
      <svg class="diagram-lines" id="diagram-lines"></svg>
      <div class="diagram-tables" id="diagram-tables">
  `;

  for (const table of tables) {
    const pos = state.tablePositions[table.name] || { x: 0, y: 0 };
    html += renderDiagramTable(table, pos, relationships);
  }

  html += `
      </div>
    </div>
  `;

  mainContent.innerHTML = html;

  // Draw relationship lines
  requestAnimationFrame(() => {
    drawRelationshipLines(relationships);
    setupDragHandlers();
  });
}

function initializeTablePositions(tables) {
  const cols = Math.ceil(Math.sqrt(tables.length));
  const spacingX = 320;
  const spacingY = 280;

  tables.forEach((table, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    state.tablePositions[table.name] = {
      x: 40 + col * spacingX,
      y: 40 + row * spacingY,
    };
  });
}

function renderDiagramTable(table, pos, relationships) {
  const tableFKs = relationships.filter((r) => r.fromTable === table.name);

  let html = `
    <div class="diagram-table" data-table="${table.name}" style="left: ${pos.x}px; top: ${pos.y}px;">
      <div class="diagram-table-header" onmousedown="startDrag(event, '${table.name}')">
        <span class="diagram-table-icon">&#9634;</span>
        <span class="diagram-table-name">${table.name}</span>
        <span class="diagram-table-expand" onclick="selectTable('${table.name}')" title="View details">&#8599;</span>
      </div>
      <div class="diagram-table-columns">
  `;

  for (const col of table.columns) {
    const isPK = col.isPrimaryKey;
    const isFK = tableFKs.some((fk) => fk.fromColumn === col.name);
    const isUnique = table.indexes?.some((idx) => idx.isUnique && idx.columns.includes(col.name));

    let icons = "";
    if (isPK) icons += '<span class="col-icon pk" title="Primary Key">&#128273;</span>';
    if (isFK) icons += '<span class="col-icon fk" title="Foreign Key">&#128279;</span>';
    if (isUnique && !isPK) icons += '<span class="col-icon unique" title="Unique">&#9670;</span>';

    const nullable = col.nullable ? "nullable" : "not-null";

    html += `
      <div class="diagram-column ${nullable}">
        <span class="diagram-column-icons">${icons}</span>
        <span class="diagram-column-name">${col.name}</span>
        <span class="diagram-column-type">${col.type.toLowerCase()}</span>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  return html;
}

function drawRelationshipLines(relationships) {
  const svg = document.getElementById("diagram-lines");
  if (!svg) return;

  const container = document.getElementById("diagram-container");
  if (!container) return;

  // Clear previous lines
  svg.innerHTML = "";

  // Calculate the total bounds needed for all tables
  const tables = container.querySelectorAll(".diagram-table");
  let maxX = 800,
    maxY = 600;
  tables.forEach((table) => {
    const rect = table.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const right = rect.right - containerRect.left + container.scrollLeft;
    const bottom = rect.bottom - containerRect.top + container.scrollTop;
    maxX = Math.max(maxX, right + 50);
    maxY = Math.max(maxY, bottom + 50);
  });

  svg.style.width = maxX + "px";
  svg.style.height = maxY + "px";
  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);

  for (const rel of relationships) {
    const fromTable = document.querySelector(`[data-table="${rel.fromTable}"]`);
    const toTable = document.querySelector(`[data-table="${rel.toTable}"]`);

    if (!fromTable || !toTable) continue;

    // Get positions relative to the diagram container
    const fromPos = state.tablePositions[rel.fromTable];
    const toPos = state.tablePositions[rel.toTable];

    if (!fromPos || !toPos) continue;

    const fromRect = fromTable.getBoundingClientRect();
    const toRect = toTable.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Find the specific column elements
    const fromColumns = fromTable.querySelectorAll(".diagram-column");
    const toColumns = toTable.querySelectorAll(".diagram-column");

    let fromColEl = null,
      toColEl = null;
    fromColumns.forEach((col) => {
      if (col.querySelector(".diagram-column-name")?.textContent === rel.fromColumn) {
        fromColEl = col;
      }
    });
    toColumns.forEach((col) => {
      if (col.querySelector(".diagram-column-name")?.textContent === rel.toColumn) {
        toColEl = col;
      }
    });

    // Calculate Y positions from actual element positions
    let fromColY, toColY;

    if (fromColEl) {
      const fromColRect = fromColEl.getBoundingClientRect();
      fromColY = fromColRect.top + fromColRect.height / 2 - containerRect.top + container.scrollTop;
    } else {
      fromColY = fromPos.y + 50; // fallback
    }

    if (toColEl) {
      const toColRect = toColEl.getBoundingClientRect();
      toColY = toColRect.top + toColRect.height / 2 - containerRect.top + container.scrollTop;
    } else {
      toColY = toPos.y + 50; // fallback
    }

    // Calculate X positions based on table positions
    const fromWidth = fromRect.width;
    const toWidth = toRect.width;

    let fromX, toX;

    // Determine which sides to connect
    if (fromPos.x + fromWidth < toPos.x) {
      // From table is to the left
      fromX = fromPos.x + fromWidth;
      toX = toPos.x;
    } else if (toPos.x + toWidth < fromPos.x) {
      // From table is to the right
      fromX = fromPos.x;
      toX = toPos.x + toWidth;
    } else {
      // Tables overlap horizontally, connect on closest sides
      const fromCenter = fromPos.x + fromWidth / 2;
      const toCenter = toPos.x + toWidth / 2;
      if (fromCenter < toCenter) {
        fromX = fromPos.x + fromWidth;
        toX = toPos.x;
      } else {
        fromX = fromPos.x;
        toX = toPos.x + toWidth;
      }
    }

    // Draw a curved bezier line
    const controlOffset = Math.min(80, Math.abs(toX - fromX) / 2);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Create a smooth S-curve
    const c1x = fromX + (fromX < toX ? controlOffset : -controlOffset);
    const c2x = toX + (fromX < toX ? -controlOffset : controlOffset);

    path.setAttribute(
      "d",
      `M ${fromX} ${fromColY} C ${c1x} ${fromColY}, ${c2x} ${toColY}, ${toX} ${toColY}`
    );
    path.setAttribute("class", "relationship-line");
    path.setAttribute("data-from", rel.fromTable);
    path.setAttribute("data-to", rel.toTable);
    svg.appendChild(path);

    // Add arrow marker at the end pointing to the target
    const arrowSize = 6;
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const arrowDir = fromX < toX ? 1 : -1;
    arrow.setAttribute(
      "points",
      `${toX},${toColY} ${toX - arrowDir * arrowSize * 1.5},${toColY - arrowSize} ${toX - arrowDir * arrowSize * 1.5},${toColY + arrowSize}`
    );
    arrow.setAttribute("class", "relationship-arrow");
    svg.appendChild(arrow);

    // Add a small circle at the start (FK side)
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", fromX);
    circle.setAttribute("cy", fromColY);
    circle.setAttribute("r", 4);
    circle.setAttribute("class", "relationship-dot");
    svg.appendChild(circle);
  }
}

// Drag handling
let dragState = null;

function startDrag(event, tableName) {
  if (event.target.classList.contains("diagram-table-expand")) return;

  event.preventDefault();
  const _tableEl = document.querySelector(`[data-table="${tableName}"]`);
  const _container = document.getElementById("diagram-container");
  const _containerRect = _container.getBoundingClientRect();

  dragState = {
    tableName,
    startX: event.clientX,
    startY: event.clientY,
    initialX: state.tablePositions[tableName].x,
    initialY: state.tablePositions[tableName].y,
  };

  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", endDrag);
}

function onDrag(event) {
  if (!dragState) return;

  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;

  const newX = Math.max(0, dragState.initialX + deltaX);
  const newY = Math.max(0, dragState.initialY + deltaY);

  state.tablePositions[dragState.tableName] = { x: newX, y: newY };

  const tableEl = document.querySelector(`[data-table="${dragState.tableName}"]`);
  if (tableEl) {
    tableEl.style.left = newX + "px";
    tableEl.style.top = newY + "px";
  }

  // Redraw lines
  drawRelationshipLines(state.relationships?.relationships || []);
}

function endDrag() {
  dragState = null;
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", endDrag);
}

function setupDragHandlers() {
  // Already handled by inline onmousedown
}

function selectTable(name) {
  state.selectedItem = name;
  state.diagramMode = false;
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
      <button class="back-btn" onclick="showDiagram()">&#8592; Back to Diagram</button>
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
          <span class="table-name clickable" onclick="selectTable('${fk.referencesTable}')">${fk.referencesTable}</span>.<span class="column-name">${fk.referencesColumn}</span>
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
          <span class="table-name clickable" onclick="selectTable('${rel.fromTable}')">${rel.fromTable}</span>.<span class="column-name">${rel.fromColumn}</span>
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
      html += `<span class="tag tag-primary clickable" onclick="switchToSchemaAndSelect('${table}')">${table}</span>`;
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

function switchToSchemaAndSelect(tableName) {
  state.currentTab = "schema";
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === "schema"));
  selectTable(tableName);
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
window.showDiagram = showDiagram;
window.startDrag = startDrag;
window.switchToSchemaAndSelect = switchToSchemaAndSelect;

// Start the app
init();
