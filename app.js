// ぼんやりメモ（タグ検索付き）

const STORAGE_KEY = "bonmemo_cards_v2";

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

let activeTag = null;

function nowISO() {
  return new Date().toISOString();
}

function ymdhmLocal(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ymdhmFile(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/* タグ抽出 */

function extractTags(text) {
  const tags = [...text.matchAll(/#([^\s#]+)/g)].map(m => m[1]);
  return [...new Set(tags)];
}

/* storage */

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

let cards = loadCards();
let selected = new Set();

/* view */

function show(viewName) {

  els.viewCapture.classList.toggle("hidden", viewName !== "capture");
  els.viewInbox.classList.toggle("hidden", viewName !== "inbox");
  els.viewExport.classList.toggle("hidden", viewName !== "export");

  if (viewName === "capture") {
    setTimeout(() => els.input.focus(), 50);
  }

  if (viewName === "inbox") render();
}

/* add */

function addCard(text) {

  const trimmed = (text ?? "").trim();
  if (!trimmed) return;

  const createdAt = nowISO();
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const tags = extractTags(trimmed);

  cards.unshift({ id, createdAt, text: trimmed, tags });

  saveCards(cards);

  els.input.value = "";
}

/* delete */

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

/* render */

function render() {

  els.cards.innerHTML = "";

  const visibleCards = activeTag
    ? cards.filter(c => c.tags?.includes(activeTag))
    : cards;

  els.emptyState.style.display = visibleCards.length ? "none" : "block";

  if (activeTag) {

    const tagInfo = document.createElement("div");

    tagInfo.className = "meta";
    tagInfo.style.marginBottom = "10px";
    tagInfo.textContent = "タグ検索: #" + activeTag + "（タップで解除）";

    tagInfo.onclick = () => {
      activeTag = null;
      render();
    };

    els.cards.appendChild(tagInfo);
  }

  for (const c of visibleCards) {

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

    chk.addEventListener("change", e => {
      toggleSelect(c.id, e.target.checked);
    });

    const editBtn = document.createElement("button");
    editBtn.className = "smallbtn";
    editBtn.textContent = "編集";

    editBtn.onclick = () => {

      els.input.value = c.text;

      cards = cards.filter(x => x.id !== c.id);

      selected.delete(c.id);

      saveCards(cards);

      show("capture");
    };

    actions.appendChild(chk);
    actions.appendChild(editBtn);

    head.appendChild(meta);
    head.appendChild(actions);

    const body = document.createElement("div");
    body.className = "cardText";
    body.textContent = c.text;

    card.appendChild(head);
    card.appendChild(body);

    /* tags */

    if (c.tags && c.tags.length) {

      const tagBox = document.createElement("div");
      tagBox.className = "meta";
      tagBox.style.marginTop = "6px";

      c.tags.forEach(tag => {

        const t = document.createElement("span");

        t.textContent = "#" + tag;
        t.style.marginRight = "10px";
        t.style.cursor = "pointer";

        t.onclick = () => {

          if (activeTag === tag) {
            activeTag = null;
          } else {
            activeTag = tag;
          }

          render();
        };

        tagBox.appendChild(t);

      });

      card.appendChild(tagBox);
    }

    els.cards.appendChild(card);
  }
}

/* export */

function selectedCards() {
  return cards.filter(c => selected.has(c.id));
}

function mdForCard(card) {

  const d = new Date(card.createdAt);

  const header = `# ${ymdhmLocal(d)}\n\n`;

  const tagLine = card.tags?.length
    ? `tags: ${card.tags.join(", ")}\n\n`
    : "";

  return header + tagLine + card.text.trim() + "\n";
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
    alert("JSZipが読み込めませんでした。");
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

/* events */

els.btnAdd.addEventListener("click", () => {
  addCard(els.input.value);
});

els.input.addEventListener("keydown", e => {

  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    addCard(els.input.value);
  }

});

els.btnInbox.onclick = () => show("inbox");
els.btnCapture.onclick = () => show("capture");
els.btnExport.onclick = () => show("export");

els.btnSelectAll.onclick = () => {
  for (const c of cards) selected.add(c.id);
  render();
};

els.btnClearSel.onclick = () => {
  selected.clear();
  render();
};

els.btnDeleteSel.onclick = () => {

  if (selected.size === 0) return;

  if (confirm("選択したカードを削除します。よろしいですか？")) {
    deleteSelected();
  }
};

els.btnExportZip.onclick = exportZip;
els.btnExportOne.onclick = exportOneFile;

/* init */

show("capture");
render();