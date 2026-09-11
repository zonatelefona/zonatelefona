document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "zonatelefona-evidencija";

  const KATEGORIJE_LABELS = {
    "iphone-adapter": "iPhone adapter",
    "iphone-c-c": "iPhone C na C",
    "iphone-c-lightning": "iPhone C na Lightning",
    "samsung": "Samsung punjač",
    "xiaomi": "Xiaomi punjač"
  };

  const form = document.getElementById("item-form");
  const fTip = document.getElementById("f-tip");
  const fKategorijaWrap = document.getElementById("f-kategorija-wrap");
  const fKategorija = document.getElementById("f-kategorija");
  const fNaziv = document.getElementById("f-naziv");
  const fDatumNabavke = document.getElementById("f-datum-nabavke");
  const fNabavna = document.getElementById("f-nabavna");
  const fProdajna = document.getElementById("f-prodajna");
  const fStatus = document.getElementById("f-status");
  const fDatumProdajeWrap = document.getElementById("f-datum-prodaje-wrap");
  const fDatumProdaje = document.getElementById("f-datum-prodaje");

  const filterTip = document.getElementById("filter-tip");
  const filterKategorija = document.getElementById("filter-kategorija");
  const filterStatus = document.getElementById("filter-status");
  const exportBtn = document.getElementById("export-csv");

  const itemsBody = document.getElementById("items-body");
  const emptyMsg = document.getElementById("empty-msg");
  const categoryBody = document.getElementById("category-body");

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  let items = loadItems();

  function toggleKategorijaField() {
    fKategorijaWrap.style.display = fTip.value === "punjac" ? "flex" : "none";
  }

  function toggleDatumProdajeField() {
    fDatumProdajeWrap.style.display = fStatus.value === "prodato" ? "flex" : "none";
  }

  fTip.addEventListener("change", toggleKategorijaField);
  fStatus.addEventListener("change", toggleDatumProdajeField);
  toggleKategorijaField();
  toggleDatumProdajeField();

  function formatMoney(n) {
    return n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function kategorijaLabel(item) {
    if (item.tip === "punjac") return KATEGORIJE_LABELS[item.kategorija] || item.kategorija;
    return "—";
  }

  function render() {
    const filtered = items.filter(item => {
      if (filterTip.value && item.tip !== filterTip.value) return false;
      if (filterKategorija.value && item.kategorija !== filterKategorija.value) return false;
      if (filterStatus.value && item.status !== filterStatus.value) return false;
      return true;
    });

    itemsBody.innerHTML = "";
    emptyMsg.style.display = filtered.length ? "none" : "block";

    filtered.slice().reverse().forEach(item => {
      const tr = document.createElement("tr");

      const tipTd = document.createElement("td");
      tipTd.textContent = item.tip === "telefon" ? "Telefon" : "Punjač";
      tr.appendChild(tipTd);

      const katTd = document.createElement("td");
      katTd.textContent = kategorijaLabel(item);
      tr.appendChild(katTd);

      const nazivTd = document.createElement("td");
      nazivTd.textContent = item.naziv;
      tr.appendChild(nazivTd);

      const nabDatTd = document.createElement("td");
      nabDatTd.textContent = item.datumNabavke || "—";
      tr.appendChild(nabDatTd);

      const prodDatTd = document.createElement("td");
      prodDatTd.textContent = item.datumProdaje || "—";
      tr.appendChild(prodDatTd);

      const nabTd = document.createElement("td");
      nabTd.textContent = formatMoney(item.nabavna);
      tr.appendChild(nabTd);

      const prodTd = document.createElement("td");
      prodTd.textContent = item.prodajna != null ? formatMoney(item.prodajna) : "—";
      tr.appendChild(prodTd);

      const profitTd = document.createElement("td");
      if (item.status === "prodato" && item.prodajna != null) {
        const profit = item.prodajna - item.nabavna;
        profitTd.textContent = formatMoney(profit);
        profitTd.className = profit >= 0 ? "profit-positive" : "profit-negative";
      } else {
        profitTd.textContent = "—";
      }
      tr.appendChild(profitTd);

      const statusTd = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "status-badge " + item.status;
      badge.textContent = item.status === "prodato" ? "Prodato" : "Na stanju";
      statusTd.appendChild(badge);
      tr.appendChild(statusTd);

      const actionTd = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "🗑";
      delBtn.type = "button";
      delBtn.addEventListener("click", () => {
        items = items.filter(i => i.id !== item.id);
        saveItems(items);
        render();
      });
      actionTd.appendChild(delBtn);
      tr.appendChild(actionTd);

      itemsBody.appendChild(tr);
    });

    renderStats();
    renderCategorySummary();
  }

  function renderStats() {
    const ulozeno = items.reduce((sum, i) => sum + i.nabavna, 0);
    const prodati = items.filter(i => i.status === "prodato" && i.prodajna != null);
    const naplaceno = prodati.reduce((sum, i) => sum + i.prodajna, 0);
    const profit = prodati.reduce((sum, i) => sum + (i.prodajna - i.nabavna), 0);
    const naStanju = items.filter(i => i.status === "stanje").length;

    document.getElementById("stat-uloz").textContent = formatMoney(ulozeno);
    document.getElementById("stat-naplac").textContent = formatMoney(naplaceno);
    document.getElementById("stat-profit").textContent = formatMoney(profit);
    document.getElementById("stat-stanje").textContent = naStanju;
    document.getElementById("stat-prodato").textContent = prodati.length;
  }

  function renderCategorySummary() {
    const groups = {};
    items.filter(i => i.status === "prodato" && i.prodajna != null).forEach(i => {
      const key = i.tip === "telefon" ? "Telefon" : (KATEGORIJE_LABELS[i.kategorija] || i.kategorija);
      if (!groups[key]) groups[key] = { count: 0, profit: 0 };
      groups[key].count += 1;
      groups[key].profit += i.prodajna - i.nabavna;
    });

    categoryBody.innerHTML = "";
    Object.keys(groups).sort().forEach(key => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = key;
      const countTd = document.createElement("td");
      countTd.textContent = groups[key].count;
      const profitTd = document.createElement("td");
      profitTd.textContent = formatMoney(groups[key].profit);
      profitTd.className = groups[key].profit >= 0 ? "profit-positive" : "profit-negative";
      tr.appendChild(nameTd);
      tr.appendChild(countTd);
      tr.appendChild(profitTd);
      categoryBody.appendChild(tr);
    });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();

    const tip = fTip.value;
    const prodajnaRaw = fProdajna.value;
    const status = fStatus.value;

    if (status === "prodato" && prodajnaRaw === "") {
      alert("Unesi prodajnu cenu za artikal koji je označen kao prodat.");
      return;
    }

    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      tip,
      kategorija: tip === "punjac" ? fKategorija.value : null,
      naziv: fNaziv.value.trim(),
      datumNabavke: fDatumNabavke.value,
      datumProdaje: status === "prodato" ? fDatumProdaje.value : "",
      nabavna: parseFloat(fNabavna.value),
      prodajna: prodajnaRaw === "" ? null : parseFloat(prodajnaRaw),
      status
    };

    items.push(item);
    saveItems(items);
    render();
    form.reset();
    toggleKategorijaField();
    toggleDatumProdajeField();
  });

  [filterTip, filterKategorija, filterStatus].forEach(el => {
    el.addEventListener("change", render);
  });

  exportBtn.addEventListener("click", () => {
    const header = ["Tip", "Kategorija", "Naziv", "Datum nabavke", "Datum prodaje", "Nabavna", "Prodajna", "Profit", "Status"];
    const rows = items.map(i => [
      i.tip === "telefon" ? "Telefon" : "Punjac",
      kategorijaLabel(i),
      i.naziv,
      i.datumNabavke || "",
      i.datumProdaje || "",
      i.nabavna.toFixed(2),
      i.prodajna != null ? i.prodajna.toFixed(2) : "",
      i.status === "prodato" && i.prodajna != null ? (i.prodajna - i.nabavna).toFixed(2) : "",
      i.status === "prodato" ? "Prodato" : "Na stanju"
    ]);

    const csvContent = [header, ...rows]
      .map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(","))
      .join("\r\n");

    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evidencija-prodaje.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  render();
});
