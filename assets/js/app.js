(() => {
  // ===== Initial data (your array) =====
  const INITIAL_DATA = [
    { "name": "chicago", "street_address": "1111 W 35th St. 5th Floor", "state": "Illinois", "city": "Chicago", "zip_code": "60609", "status" : "0"},
    { "name":"florida", "street_address": "701 Clematis Street, Suite 202", "state": "Florida", "city": "West Palm Beach", "zip_code": "33401-3015", "status" : "0" },
    { "name":"newyork", "street_address": "55 West 46th Street", "state": "New York", "city": "New York", "zip_code": "10036-4120", "status" : "0" },
    { "name": "western_texas", "street_address": "2532 Reunion Blvd", "state": "Texas", "city": "Austin", "zip_code": "78737" , "status" : "0"},
    { "name": "eastern_texas", "street_address": "123 N Main St", "state": "Texas", "city": "Tyler", "zip_code": "75702", "status" : "0" },
    { "name": "western_pennsylvania", "street_address": "10 Timberlane Dr", "state": "Pennsylvania", "city": "Pittsburgh", "zip_code": "15238", "status" : "0" },
    { "name": "northern_georgia", "street_address": "2151 East St NE", "state": "Georgia", "city": "Covington", "zip_code": "30014", "status" : "0" },
    { "name": "middle_florida", "street_address": "720 Sunset Blvd", "state": "Florida", "city": "Kissimmee", "zip_code": "34741", "status" : "0" }
  ];

  // ===== Utilities =====
  const STORAGE_KEY = "locations:v1";
  const uid = () => Math.random().toString(36).slice(2);
  const $ = sel => document.querySelector(sel);

  function toast(msg, ok=false){
    const box = $("#toast");
    const el = document.createElement("div");
    el.className = "toast" + (ok ? " ok" : "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .3s"; }, 1800);
    setTimeout(()=> el.remove(), 2300);
  }
  toast.success = m => toast(m, true);

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : null;
    }catch { return null; }
  }
  function save(items){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }catch {}
  }

  // ===== State =====
  let rows = [];        // {id, name, street_address, state, city, zip_code, status: boolean}
  let selected = {};    // id -> true
  let editingId = null; // id currently being edited
  let query = "";
  let pendingDelete = null; // {id, name}

  // ===== Elements =====
  const elQ = $("#q");
  const elName = $("#name");
  const elStreet = $("#street");
  const elState = $("#state");
  const elCity = $("#city");
  const elZip = $("#zip");
  const elAdd = $("#add");
  const elBulkOn = $("#bulk-on");
  const elBulkOff = $("#bulk-off");
  const elClear = $("#clear");
  const elExport = $("#export");
  const elList = $("#list");
  const elCounts = $("#counts");
  const elSelected = $("#selected");
  const elSelCount = $("#sel-count");
  const elSelectAll = $("#select-all");
  // Delete Modal
  const elDeleteModal = $("#delete-modal");
  const elDelName = $("#del-name");
  const elDelCancel = $("#del-cancel");
  const elDelConfirm = $("#del-confirm");

  // ===== Init =====
  function init(){
    const persisted = load();
    if (persisted) {
      rows = persisted;
    } else {
      // prime with provided data
      rows = INITIAL_DATA.map(x => ({
        id: uid(),
        name: x.name || "",
        street_address: x.street_address || "",
        state: x.state || "",
        city: x.city || "",
        zip_code: x.zip_code || "",
        status: (x.status === "1") // internally boolean
      }));
      save(rows);
    }
    render();
  }

  // ===== Derived =====
  function filtered(){
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.name || "").toLowerCase().includes(q) ||
      (r.street_address || "").toLowerCase().includes(q) ||
      (r.state || "").toLowerCase().includes(q) ||
      (r.city || "").toLowerCase().includes(q) ||
      (r.zip_code || "").toLowerCase().includes(q)
    );
  }
  function selectedIds(){ return Object.keys(selected).filter(id => selected[id]); }

  // ===== Actions =====
  function addRow(){
    const name = (elName.value||"").trim();
    if (!name){ toast("Name is required."); return; }
    const newRow = {
      id: uid(),
      name,
      street_address: elStreet.value||"",
      state: elState.value||"",
      city: elCity.value||"",
      zip_code: elZip.value||"",
      status: true
    };
    rows = [newRow, ...rows];
    save(rows);
    elName.value = ""; elStreet.value = ""; elState.value = ""; elCity.value = ""; elZip.value = "";
    toast.success("Added.");
    render();
  }

  function removeRow(id){
    rows = rows.filter(r => r.id !== id);
    delete selected[id];
    save(rows);
    render();
  }

  function toggleStatus(id, value){
    rows = rows.map(r => r.id === id ? {...r, status: value} : r);
    save(rows);
  }

  function startEdit(row){
    editingId = row.id;
    render();
    const firstInput = elList.querySelector(`input[data-e="${row.id}"][data-field="name"]`) ||
                       elList.querySelector(`input[data-e="${row.id}"]`);
    if (firstInput){ firstInput.focus(); firstInput.select && firstInput.select(); }
  }

  function commitEdit(id){
    const inputs = elList.querySelectorAll(`input[data-e="${id}"]`);
    const updated = {};
    inputs.forEach(inp => { updated[inp.dataset.field] = inp.value; });
    if (!updated.name || !updated.name.trim()){
      toast("Name cannot be empty.");
      return;
    }
    rows = rows.map(r => r.id === id ? {
      ...r,
      name: (updated.name||"").trim(),
      street_address: (updated.street_address||"").trim(),
      state: (updated.state||"").trim(),
      city: (updated.city||"").trim(),
      zip_code: (updated.zip_code||"").trim(),
    } : r);
    editingId = null;
    save(rows);
    toast.success("Saved changes.");
    render();
  }

  function cancelEdit(){
    editingId = null;
    render();
  }

  function bulkSet(val){
    const ids = selectedIds();
    if (ids.length === 0){ toast("Select at least one item first."); return; }
    rows = rows.map(r => selected[r.id] ? {...r, status: val} : r);
    save(rows);
    toast.success(`${val ? "Enabled" : "Disabled"} ${ids.length} ${ids.length===1 ? "location" : "locations"}.`);
    render();
  }

  function clearSelection(){
    if (Object.keys(selected).length === 0) return;
    selected = {};
    elSelectAll.checked = false;
    elSelectAll.indeterminate = false;
    elList.querySelectorAll('input.row-select').forEach(cb => {
      cb.checked = false;
    });
    renderSelectionUI();
  }


  function exportJSON(){
    const payload = rows.map(r => ({
      name: r.name,
      street_address: r.street_address,
      state: r.state,
      city: r.city,
      zip_code: r.zip_code,
      status: r.status ? "1" : "0"
    }));
    const text = JSON.stringify(payload, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=> toast.success("JSON copied to clipboard."));
    }

    const blob = new Blob([text], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "locations.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

    // ===== Delete Modal =====
  function openDeleteModal(row){
    pendingDelete = { id: row.id, name: row.name };
    elDelName.textContent = `"${row.name}"`;
    elDeleteModal.hidden = false;
    elDelConfirm.focus();

    function onKey(e){ if (e.key === "Escape") closeDeleteModal(); }
    elDeleteModal._escHandler = onKey;
    document.addEventListener("keydown", onKey);

    function onOverlayClick(e){ if (e.target === elDeleteModal) closeDeleteModal(); }
    elDeleteModal._overlayHandler = onOverlayClick;
    elDeleteModal.addEventListener("click", onOverlayClick);
  }

  function closeDeleteModal(){
    elDeleteModal.hidden = true;
    document.removeEventListener("keydown", elDeleteModal._escHandler);
    elDeleteModal.removeEventListener("click", elDeleteModal._overlayHandler);
    pendingDelete = null;
  }

  function confirmDelete(){
    if (!pendingDelete) return;
    removeRow(pendingDelete.id);
    toast.success(`Removed "${pendingDelete.name}".`);
    closeDeleteModal();
  }

  // ===== Render =====
  function render(){
    const list = $("#list");
    list.innerHTML = "";
    const data = filtered();
    if (data.length === 0){
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No results.";
      list.appendChild(li);
    } else {
      for (const r of data){
        const li = document.createElement("li");
        li.className = "row";

        // checkbox
        const c0 = document.createElement("div");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "row-select";  
        cb.checked = !!selected[r.id];
        cb.addEventListener("change", e => { selected[r.id] = e.target.checked; renderSelectionUI(); });
        c0.appendChild(cb);

        function textCell(text, className="cell-text"){
          const d = document.createElement("div");
          d.className = className;
          d.textContent = text || "";
          return d;
        }
        function editCell(field, val){
          const d = document.createElement("div");
          const inp = document.createElement("input");
          inp.className = "edit-input";
          inp.value = val || "";
          inp.setAttribute("data-e", r.id);
          inp.setAttribute("data-field", field);
          inp.addEventListener("keydown", e=>{
            if (e.key === "Enter") commitEdit(r.id);
            if (e.key === "Escape") cancelEdit();
          });
          d.appendChild(inp);
          return d;
        }

        const editing = editingId === r.id;

        // name
        li.appendChild(editing ? editCell("name", r.name) : textCell(r.name));

        // street_address
        li.appendChild(editing ? editCell("street_address", r.street_address) : textCell(r.street_address));

        // state
        li.appendChild(editing ? editCell("state", r.state) : textCell(r.state, "cell-text col-state"));

        // city
        li.appendChild(editing ? editCell("city", r.city) : textCell(r.city, "cell-text col-city"));

        // zip_code
        li.appendChild(editing ? editCell("zip_code", r.zip_code) : textCell(r.zip_code, "cell-text col-zip"));

        // status (switch + badge)
        const c6 = document.createElement("div");
        c6.className = "col-status";
        const wrap = document.createElement("div");
        wrap.style.display = "flex"; wrap.style.gap = "8px"; wrap.style.alignItems = "center";

        const lbl = document.createElement("label"); lbl.className = "switch";
        const sw = document.createElement("input"); sw.type = "checkbox"; sw.checked = !!r.status;
        const sld = document.createElement("span"); sld.className = "slider";
        lbl.appendChild(sw); lbl.appendChild(sld);

        const badge = document.createElement("span");
        badge.className = "badge " + (r.status ? "on" : "off");
        badge.textContent = r.status ? "enabled" : "disabled";

        sw.addEventListener("change", e => {
          toggleStatus(r.id, e.target.checked);
          badge.className = "badge " + (e.target.checked ? "on" : "off");
          badge.textContent = e.target.checked ? "enabled" : "disabled";
        });

        wrap.appendChild(lbl); wrap.appendChild(badge);
        c6.appendChild(wrap);
        li.appendChild(c6);

        // actions
        const c7 = document.createElement("div");
        c7.className = "actions col-actions";
        if (!editing) {
          const rename = document.createElement("button");
          rename.className = "btn btn-sm";
          rename.textContent = "Edit";
          rename.addEventListener("click", () => startEdit(r));
          c7.appendChild(rename);

          const del = document.createElement("button");
          del.className = "btn btn-sm danger";
          del.textContent = "Remove";
          del.addEventListener("click", () => openDeleteModal(r));  //Delete modal
          c7.appendChild(del);

        } else {
          const saveBtn = document.createElement("button");
          saveBtn.className = "btn btn-sm primary";
          saveBtn.textContent = "Save";
          saveBtn.addEventListener("click", () => commitEdit(r.id));

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "btn btn-sm safe";
          cancelBtn.textContent = "Cancel";
          cancelBtn.addEventListener("click", cancelEdit);

          c7.appendChild(saveBtn);
          c7.appendChild(cancelBtn);
        }

        // prepend the checkbox cell at the very start
        li.prepend(c0);
        li.appendChild(c7);
        elList.appendChild(li);
      }
    }
    renderCounts();
    renderSelectionUI();
  }

  function renderCounts(){
    const total = rows.length;
    const enabled = rows.filter(r=>r.status).length;
    const disabled = total - enabled;
    elCounts.innerHTML = `Total: <span class="strong">${total}</span> • Enabled: ${enabled} • Disabled: ${disabled}`;
  }

  function renderSelectionUI(){
    const data = filtered();
    const all = data.length > 0 && data.every(r => !!selected[r.id]);
    const some = data.some(r => !!selected[r.id]) && !all;
    elSelectAll.checked = all;
    elSelectAll.indeterminate = some;

    const sel = selectedIds().length;
    elSelCount.textContent = sel;
    elSelected.hidden = sel === 0;
    elClear.hidden = sel === 0;
  }

  // ===== Events =====
  elAdd.addEventListener("click", addRow);
  [elName, elStreet, elState, elCity, elZip].forEach(inp => {
    inp.addEventListener("keydown", e => { if (e.key === "Enter") addRow(); });
  });

  elQ.addEventListener("input", e => { query = e.target.value; render(); });

  elBulkOn.addEventListener("click", ()=> bulkSet(true));
  elBulkOff.addEventListener("click", ()=> bulkSet(false));
  elClear.addEventListener("click", clearSelection);
  elExport.addEventListener("click", exportJSON);

  elSelectAll.addEventListener("change", e => {
    const data = filtered();
    const checked = e.target.checked;
    data.forEach(r => { selected[r.id] = checked; });
    render();
  });
  // Delete Modal
  elDelCancel.addEventListener("click", closeDeleteModal);
  elDelConfirm.addEventListener("click", confirmDelete);
  // Boot
  init();
})();
