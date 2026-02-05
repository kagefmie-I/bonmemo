// ぼんやりメモ（プロトタイプ）
// - localStorage保存
// - 1カード = 1メモ
// - 受信箱で選択 → Markdown書き出し（zip or 1ファイル）

const STORAGE_KEY = "bonmemo_cards_v1";

const els = {
  viewCapture: document.getElementById("viewCapture"),
  viewInbox: document.getElementById("viewInbox"),
  viewExport: document.getElementById("viewExport"),

  btnInbox: document.getElementById("btnInbox"),
  btnCapture: document.getElementById("btnCapture"),
  btnExport: document.getElementById("btnExport"),

  input: document.getElementById("input"),
  btnAdd: document.getElementById("btnAdd"),

  cards: document.getElementById("cards"),
  emptyState: document.getElementById("emptyState"),

  btnSelectAll: document.getElementById("btnSelectAll"),
  btnClearSel: document.getElementById("btnClearSel"),
  btnDeleteSel: document.getElementById("btnDeleteSel"),

  prefix: document.getElementById("prefix"),
  btnExportZip: document.getElementById("btnExportZip"),
  btnExportOne: document.getElementById("btnExportOne"),
};

function nowISO() {
  return new Date().toISOString();
}

function ymdhmLocal(d) {
  // YYYY-MM-DD HH:MM (local)
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ymdhmFile(d) {
  // YYYY-MM-DD_HHMM
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

let cards = loadCards(); // newest first
let selected = new Set();

function show(viewName) {
  els.viewCapture.classList.toggle("hidden", viewName !== "capture");
  els.viewInbox.classList.toggle("hidden", viewName !== "inbox");
  els.viewExport.classList.toggle("hidden", viewName !== "export");

  if (viewName === "capture") {
    setTimeout(() => els.input.focus(), 50);
  }
  if (viewName === "inbox") render();
}

function addCard(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return;
  const createdAt = nowISO();
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  cards.unshift({ id, createdAt, text: trimmed });
  saveCards(cards);
  els.input.value = "";
}

function deleteSelected() {
  if (selected.size === 0) return;
  cards = cards.filter(c => !selected.has(c.id));
  selected.clear();
  saveCards(cards);
  render();
}

function toggleSelect(id, on) {
  if (on) selected.add(id);
  else selected.delete(id);
}

function render() {
  els.cards.innerHTML = "";
  els.emptyState.style.display = cards.length ? "none" : "block";

  for (const c of cards) {
    const d = new Date(c.createdAt);
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "cardHead";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = ymdhmLocal(d);

    const actions = document.createElement("div");
    actions.className = "cardActions";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "chk";
    chk.checked = selected.has(c.id);
    chk.addEventListener("change", (e) => toggleSelect(c.id, e.target.checked));

    const editBtn = document.createElement("button");
    editBtn.className = "smallbtn";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", () => {
      // Simple: move to capture for editing
      els.input.value = c.text;
      // remove old card; new save becomes new card (prototype behavior)
      cards = cards.filter(x => x.id !== c.id);
      selected.delete(c.id);
      saveCards(cards);
      show("capture");
    });

    actions.appendChild(chk);
    actions.appendChild(editBtn);

    head.appendChild(meta);
    head.appendChild(actions);

    const body = document.createElement("div");
    body.className = "cardText";
    body.textContent = c.text;

    card.appendChild(head);
    card.appendChild(body);

    els.cards.appendChild(card);
  }
}

function selectedCards() {
  const sel = cards.filter(c => selected.has(c.id));
  // preserve newest-first in export
  return sel;
}

function mdForCard(card) {
  const d = new Date(card.createdAt);
  const header = `# ${ymdhmLocal(d)}\n\n`;
  return header + card.text.trim() + "\n";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportZip() {
  const sel = selectedCards();
  if (sel.length === 0) {
    alert("受信箱でカードを選択してください。");
    return;
  }
  if (typeof JSZip === "undefined") {
    alert("JSZipが読み込めませんでした。ネット接続が必要です。");
    return;
  }
  const zip = new JSZip();
  const pref = (els.prefix.value || "").trim() || "bonmemo_";

  for (const c of sel) {
    const d = new Date(c.createdAt);
    const fname = `${pref}${ymdhmFile(d)}.md`;
    zip.file(fname, mdForCard(c));
  }

  const content = await zip.generateAsync({ type: "blob" });
  downloadBlob(content, `${pref}export.zip`);
}

function exportOneFile() {
  const sel = selectedCards();
  if (sel.length === 0) {
    alert("受信箱でカードを選択してください。");
    return;
  }
  const pref = (els.prefix.value || "").trim() || "bonmemo_";
  const parts = sel.map(c => mdForCard(c) + "\n---\n\n");
  const blob = new Blob(parts, { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${pref}export.md`);
}

// Events
els.btnAdd.addEventListener("click", () => {
  addCard(els.input.value);
});

els.input.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    addCard(els.input.value);
  }
});

els.btnInbox.addEventListener("click", () => show("inbox"));
els.btnCapture.addEventListener("click", () => show("capture"));
els.btnExport.addEventListener("click", () => show("export"));

els.btnSelectAll.addEventListener("click", () => {
  for (const c of cards) selected.add(c.id);
  render();
});
els.btnClearSel.addEventListener("click", () => {
  selected.clear();
  render();
});
els.btnDeleteSel.addEventListener("click", () => {
  if (selected.size === 0) return;
  if (confirm("選択したカードを削除します。よろしいですか？")) deleteSelected();
});

els.btnExportZip.addEventListener("click", exportZip);
els.btnExportOne.addEventListener("click", exportOneFile);

// Init
show("capture");
render();
