// Placeholder - will be implemented in Phase 6
async function init() {
  const info = await fetch("/api/info").then((r) => r.json());
  document.getElementById("info").textContent =
    `${info.tableCount} tables, ${info.functionCount} functions`;

  document.querySelector("main").innerHTML = "<p>UI coming soon...</p>";
}

init();
