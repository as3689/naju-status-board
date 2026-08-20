/* =========================================================
   나주 정식 현황판 - app.js
   ========================================================= */

   const STORAGE_KEY = "naju_status_board_v2";
   const DAYS_KEY = "naju_days_settings";
   const API = "";
   
   let data = null;
   let currentSheet = null;
   let useDB = false;
   
   let globalDays = {
     nurseryDays: 7,
     transplantDays: 21,
     formalDays: 23
   };
   
   function loadGlobalDays() {
     try {
       const raw = localStorage.getItem(DAYS_KEY);
       if (raw) globalDays = { ...globalDays, ...JSON.parse(raw) };
     } catch (e) {}
   }
   
   function saveGlobalDays() {
     try { localStorage.setItem(DAYS_KEY, JSON.stringify(globalDays)); }
     catch (e) {}
   }
   
   /* ---------- 기본 데이터 ---------- */
   const DEFAULT_DATA = (() => {
     const emptyFormal = (zones, floors) =>
       floors.map(() => zones.map(() => ({ sow: null, plant: null })));
   
     const emptySideCell = () => ({
       left:  [{ sow: null, trays: null }, { sow: null, trays: null }],
       right: [{ sow: null, trays: null }, { sow: null, trays: null }]
     });
   
     const sheets = {
       "5동": {
         type: "정식", formalDays: 23, nurseryDays: 7, transplantDays: 21,
         zones: ["E6","E5","E4","E3","E2","E1","D6","D5","D4","D3","D2","D1","C3","C2","C1"],
         floors: ["1층","2층","3층","4층","5층","6층","7층","8층"]
       },
       "16동": {
         type: "정식", formalDays: 23, nurseryDays: 7, transplantDays: 21,
         zones: ["B1","B2","B3","E6","E5","E4","E3","E2","E1","D6","D5","D4","D3","D2","D1","C3","C2","C1"],
         floors: ["1층","2층","3층","4층","5층","6층","7층","8층"]
       },
       "17동": {
         type: "정식", formalDays: 23, nurseryDays: 7, transplantDays: 21,
         zones: ["B1","B2","B3","E6","E5","E4","E3","E2","E1","D6","D5","D4","D3","D2","D1","C3","C2","C1"],
         floors: ["1층","2층","3층","4층","5층","6층","7층","8층"]
       },
       "22동": {
         type: "정식", formalDays: 23, nurseryDays: 7, transplantDays: 21,
         zones: ["F1","F2","F3","D5","D4","D3","D2","D1","E7","E6","E5","E4","E3","E2","E1"],
         floors: ["1층","2층","3층","4층","5층","6층","7층","8층"]
       },
       "24동": {
         type: "정식", formalDays: 23, nurseryDays: 7, transplantDays: 21,
         zones: ["E6","E5","E4","E3","E2","E1","D6","D5","D4","D3","D2","D1","C3","C2","C1"],
         floors: ["1층","2층","3층","4층","5층","6층","7층","8층"]
       },
       "25동": {
         type: "정식", formalDays: 23, nurseryDays: 7, transplantDays: 21,
         zones: ["E6","E5","E4","E3","E2","E1","D6","D5","D4","D3","D2","D1","C3","C2","C1"],
         floors: ["1층","2층","3층","4층","5층","6층","7층","8층"]
       },
       "22-1동": {
         type: "육묘", formalDays: 23, nurseryDays: 7, transplantDays: 21,
         zones: ["B1","B2","C1","C2","C3","C4","C5","C6"],
         floors: ["1층","2층","3층","4층","5층","6층","7층","8층"]
       }
     };
   
     Object.keys(sheets).forEach(k => {
       const s = sheets[k];
       if (k === "22-1동") {
         s.plants = s.floors.map((_, fi) =>
           s.zones.map(z => {
             if ((z === "B1" || z === "B2") && fi <= 1) return emptySideCell();
             return { sow: null, plant: null };
           })
         );
       } else {
         s.plants = emptyFormal(s.zones, s.floors);
       }
     });
   
     return sheets;
   })();
   
   /* ---------- 날짜 유틸 ---------- */
   const todayStr = () => {
     const d = new Date();
     return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
   };
   const currentYear = () => new Date().getFullYear();
   const toMD = iso => {
     if (!iso) return "";
     const p = iso.split("-");
     return p.length >= 3 ? `${p[1]}/${p[2]}` : "";
   };
   const parseMD = input => {
     if (!input || !String(input).trim()) return null;
     const s = String(input).trim();
     if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
       const d = new Date(s + "T00:00:00");
       return isNaN(d.getTime()) ? null : s;
     }
     const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
     if (!m) return null;
     const month = +m[1], day = +m[2];
     if (month < 1 || month > 12 || day < 1 || day > 31) return null;
     const iso = `${currentYear()}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
     const d = new Date(iso + "T00:00:00");
     if (isNaN(d.getTime()) || d.getMonth()+1 !== month || d.getDate() !== day) return null;
     return iso;
   };
   const parseDate = s => {
     if (!s) return null;
     const iso = parseMD(s) || s;
     const d = new Date(iso + "T00:00:00");
     return isNaN(d.getTime()) ? null : d;
   };
   const daysBetween = (from, to) => {
     if (!from || !to) return null;
     return Math.floor((to.getTime() - from.getTime()) / 86400000);
   };
   const addDays = (dateStr, days) => {
     const d = parseDate(dateStr);
     if (!d) return null;
     d.setDate(d.getDate() + days);
     return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
   };
   
   /* ---------- 셀 유틸 ---------- */
   const emptySideCell = () => ({
     left:  [{ sow: null, trays: null }, { sow: null, trays: null }],
     right: [{ sow: null, trays: null }, { sow: null, trays: null }]
   });
   
   const isSideCell = (sheetName, zone, floorIndex) =>
     sheetName === "22-1동" && (zone === "B1" || zone === "B2") && floorIndex <= 1;
   
   const cellOf = (sheet, fi, zi) => {
     const row = sheet.plants[fi];
     if (!row) return { sow: null, plant: null };
     let c = row[zi];
     if (!c) return { sow: null, plant: null };
     if (typeof c === "string") return { sow: null, plant: c };
     if (c.left != null) return { sow: null, plant: null };
     return { sow: c.sow || null, plant: c.plant || null };
   };
   
   const setCell = (sheet, fi, zi, field, value) => {
     if (!sheet.plants[fi]) {
       sheet.plants[fi] = sheet.zones.map(() => ({ sow: null, plant: null }));
     }
     let c = sheet.plants[fi][zi];
     if (!c || typeof c === "string" || c.left != null) {
       c = { sow: null, plant: typeof c === "string" ? c : null };
     }
     c[field] = value;
     sheet.plants[fi][zi] = c;
   };
   
   /* ---------- 데이터 정규화 ---------- */
   function normalizeData(raw) {
     Object.keys(raw).forEach(name => {
       const sheet = raw[name];
       sheet.nurseryDays    ??= 7;
       sheet.transplantDays ??= 21;
       sheet.formalDays     ??= 23;
   
       if (name === "22-1동") {
         sheet.zones = ["B1","B2","C1","C2","C3","C4","C5","C6"];
         if (!sheet.floors?.length) {
           sheet.floors = ["1층","2층","3층","4층","5층","6층","7층","8층"];
         }
         const oldPlants = sheet.plants || [];
         sheet.plants = sheet.floors.map((_, fi) => {
           return sheet.zones.map((z, zi) => {
             if ((z === "B1" || z === "B2") && fi <= 1) {
               const old = oldPlants[fi]?.[zi];
               if (old && old.left != null) return old;
               return emptySideCell();
             }
             const old = oldPlants[fi]?.[zi];
             if (!old) return { sow: null, plant: null };
             if (typeof old === "string") return { sow: null, plant: old };
             if (old.left != null) return { sow: null, plant: null };
             return { sow: old.sow || null, plant: old.plant || null };
           });
         });
       } else {
         sheet.plants = (sheet.plants || []).map(row =>
           (row || []).map(c => {
             if (!c) return { sow: null, plant: null };
             if (typeof c === "string") return { sow: null, plant: c };
             if (c.left != null) return { sow: null, plant: null };
             return { sow: c.sow || null, plant: c.plant || null };
           })
         );
       }
     });
     return raw;
   }
   
   /* ---------- DB / localStorage ---------- */
   const setDbStatus = (ok, msg) => {
     const el = document.getElementById("dbStatus");
     if (!el) return;
     if (ok) {
       el.textContent = "● DB 연결됨";
       el.style.color = "var(--green)";
       el.style.background = "var(--green-bg)";
     } else {
       el.textContent = msg || "○ 로컬모드";
       el.style.color = "var(--yellow)";
       el.style.background = "var(--yellow-bg)";
     }
   };
   const apiGet = async path => {
     const res = await fetch(API + path);
     if (!res.ok) throw new Error(res.statusText);
     return res.json();
   };
   const apiPost = async (path, body) => {
     const res = await fetch(API + path, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(body)
     });
     if (!res.ok) throw new Error(res.statusText);
     return res.json();
   };
   const localBackup = () => {
     try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
     catch (e) { console.error("localStorage 저장 실패", e); }
   };
   const saveCellToDB = async (sheet, floor, zone, sow, plant) => {
     if (!useDB) return;
     try {
       await apiPost("/api/plant", { sheet, floor, zone, sow, plant, date: plant });
     } catch (e) {
       console.error("DB 저장 실패", e);
       showToast("DB 저장 실패");
     }
   };
   
   async function loadData() {
    try {
      const health = await apiGet("/api/health");
      if (health?.ok) {
        const remote = await apiGet("/api/data");
        useDB = true;
        setDbStatus(true);
  
        if (remote && Object.keys(remote).length) {
          data = normalizeData(remote);
        } else {
          data = normalizeData(JSON.parse(JSON.stringify(DEFAULT_DATA)));
          try { await apiPost("/api/import", data); } catch (e) {}
        }
  
        localBackup();
        return;
      }
    } catch (_) {
      console.log("DB 서버 연결 실패");
    }
  
    useDB = false;
    setDbStatus(false, "○ 로컬모드 (서버 미실행)");
  
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        data = normalizeData(JSON.parse(raw));
        Object.keys(DEFAULT_DATA).forEach(k => {
          if (!data[k]) {
            data[k] = normalizeData({ t: JSON.parse(JSON.stringify(DEFAULT_DATA[k])) }).t;
          }
        });
        return;
      }
    } catch (e) { console.error(e); }
  
    data = normalizeData(JSON.parse(JSON.stringify(DEFAULT_DATA)));
  }
   
   const saveData = () => {
     localBackup();
     showToast(useDB ? "DB에 저장됨" : "로컬에 저장됨");
   };
   const exportJSON = () => {
     localBackup();
     const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
     const a = document.createElement("a");
     a.href = URL.createObjectURL(blob);
     a.download = `정식현황판_${todayStr()}.json`;
     a.click();
     URL.revokeObjectURL(a.href);
   };
   const importJSON = ev => {
     const file = ev.target.files[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = async e => {
       try {
         data = normalizeData(JSON.parse(e.target.result));
         localBackup();
         if (useDB) {
           try { await apiPost("/api/import", data); showToast("DB 불러오기 완료"); }
           catch (_) { showToast("로컬만 적용됨"); }
         } else showToast("불러오기 완료");
         renderTabs();
         renderBoard(currentSheet || Object.keys(data)[0]);
       } catch (_) { alert("JSON 파일이 올바르지 않습니다."); }
     };
     reader.readAsText(file);
     ev.target.value = "";
   };
   
   async function clearCurrentSheet() {
     if (!currentSheet || !data[currentSheet]) return;
     if (!confirm("현재 동의 모든 날짜를 지우시겠습니까?")) return;
     const sheet = data[currentSheet];
     if (currentSheet === "22-1동") {
       sheet.plants = sheet.floors.map((_, fi) =>
         sheet.zones.map(z => {
           if ((z === "B1" || z === "B2") && fi <= 1) return emptySideCell();
           return { sow: null, plant: null };
         })
       );
     } else {
       sheet.plants = sheet.floors.map(() => sheet.zones.map(() => ({ sow: null, plant: null })));
     }
     localBackup();
     if (useDB) {
       try { await apiPost("/api/clear", { sheet: currentSheet }); } catch (e) { console.error(e); }
     }
     renderBoard(currentSheet);
     showToast("초기화됨");
   }
   
   /* ---------- Toast / Tabs / 상태 ---------- */
   const showToast = msg => {
     const t = document.getElementById("toast");
     if (!t) return;
     t.textContent = msg;
     t.classList.add("show");
     setTimeout(() => t.classList.remove("show"), 1800);
   };
   const renderTabs = () => {
     const tabs = document.getElementById("tabs");
     if (!tabs) return;
     tabs.innerHTML = "";
     Object.keys(data).forEach(name => {
       const btn = document.createElement("button");
       btn.className = "tab" + (name === currentSheet ? " active" : "");
       btn.textContent = name + (data[name].type === "육묘" ? " (육묘)" : "");
       btn.onclick = () => renderBoard(name);
       tabs.appendChild(btn);
     });
   };
   const getDaysClass = daysLeft => {
     if (daysLeft === null) return "";
     if (daysLeft <= 0) return "days-over";
     if (daysLeft <= 3) return "days-near";
     if (daysLeft <= 7) return "days-warn";
     return "days-ok";
   };
   const getHarvestClass = daysLeft => {
     if (daysLeft === null) return "";
     if (daysLeft < 0) return "past";
     if (daysLeft === 0) return "today";
     if (daysLeft <= 3) return "soon";
     return "";
   };
   const setDaysInputs = () => {
     const n = document.getElementById("nurseryDays");
     const t = document.getElementById("transplantDays");
     const f = document.getElementById("formalDays");
     if (n) n.value = globalDays.nurseryDays;
     if (t) t.value = globalDays.transplantDays;
     if (f) f.value = globalDays.formalDays;
   };
   
   /* ---------- B1/B2 1~2층 좌우 2줄 렌더 ---------- */
   function renderSideCell(fi, zi, cell, today) {
     let html = '<td><div class="nursery-rows">';
     let filled = 0, total = 0;
   
     for (let ri = 0; ri < 2; ri++) {
       html += '<div class="nursery-row">';
       ["left", "right"].forEach(side => {
         const slot = (cell[side] && cell[side][ri]) || { sow: null, trays: null };
         total++;
         if (slot.sow || slot.trays != null) filled++;
   
         let daysHtml = '<span class="empty-mark">—</span>';
         if (slot.sow) {
           const d = daysBetween(parseDate(slot.sow), today);
           if (d !== null) daysHtml = `<span class="days-badge days-ok">${d}일</span>`;
         }
   
         html += `
           <div class="nr-cell">
             <input class="date-md" type="text" inputmode="numeric" placeholder="MM/DD"
               data-f="${fi}" data-z="${zi}" data-side="${side}" data-r="${ri}" data-field="sow"
               value="${toMD(slot.sow)}"
               onchange="onSideChange(this)" onblur="onSideChange(this)">
           </div>
           <div class="nr-cell">
             <input class="tray-n" type="number" min="0" placeholder="0"
               data-f="${fi}" data-z="${zi}" data-side="${side}" data-r="${ri}" data-field="trays"
               value="${slot.trays != null ? slot.trays : ""}"
               onchange="onSideChange(this)" onblur="onSideChange(this)">
           </div>
           <div class="nr-cell">${daysHtml}</div>`;
       });
       html += "</div>";
     }
     html += "</div></td>";
     return { html, filled, total };
   }
   
   /* ---------- 현황판 렌더 ---------- */
   function renderBoard(name) {
     currentSheet = name;
     const sheet = data[name];
     if (!sheet) return;
   
     setDaysInputs();
     document.getElementById("todayDisplay").textContent = todayStr();
     renderTabs();
   
     const nurseryDays = globalDays.nurseryDays;
     const transplantDays = globalDays.transplantDays;
     const formalDays = globalDays.formalDays;
     const dayLimit = nurseryDays + transplantDays + formalDays + 2;
     const today = parseDate(todayStr());
     const table = document.getElementById("board");
   
     let html = "<thead><tr><th>구분</th>";
     sheet.zones.forEach(z => {
       if (name === "22-1동" && (z === "B1" || z === "B2")) {
         html += `<th class="zone nursery-zone">${z}
           <div class="nursery-side-head"><span>좌</span><span>우</span></div>
           <div class="nursery-col-head">
             <span>파종</span><span>수량</span><span>일수</span>
             <span>파종</span><span>수량</span><span>일수</span>
           </div></th>`;
       } else {
         html += `<th class="zone">${z}</th>`;
       }
     });
     html += "</tr></thead><tbody>";
   
     let totalCells = 0, filled = 0, harvestSoon = 0, harvestToday = 0, harvestOver = 0;
   
     for (let fi = 0; fi < sheet.floors.length; fi++) {
       html += `<tr><td class="floor">${sheet.floors[fi]}</td>`;
   
       for (let zi = 0; zi < sheet.zones.length; zi++) {
         const zoneName = sheet.zones[zi];
   
         if (isSideCell(name, zoneName, fi)) {
           const scell = sheet.plants[fi][zi] || emptySideCell();
           const r = renderSideCell(fi, zi, scell, today);
           html += r.html;
           totalCells += r.total;
           filled += r.filled;
           continue;
         }
   
         totalCells++;
         const cell = cellOf(sheet, fi, zi);
         if (cell.sow || cell.plant) filled++;
   
         const sowMD = toMD(cell.sow);
         const plantMD = toMD(cell.plant);
   
         let cultLabel = "", cultCls = "";
         if (cell.sow) {
           const cult = daysBetween(parseDate(cell.sow), today);
           if (cult !== null) {
             cultLabel = cult + "일";
             cultCls = cult > dayLimit ? "days-over" : "days-ok";
           }
         }
   
         let harvestStr = null, daysLeft = null, badgeCls = "", harvCls = "", dLabel = "";
         if (cell.plant) {
           const addCount = (name === "22-1동") ? transplantDays : formalDays;
           harvestStr = addDays(cell.plant, addCount);
           daysLeft = daysBetween(today, parseDate(harvestStr));
           badgeCls = getDaysClass(daysLeft);
           harvCls = getHarvestClass(daysLeft);
           if (daysLeft !== null) {
             dLabel = daysLeft < 0 ? `+${-daysLeft}` : `D-${daysLeft}`;
             if (daysLeft < 0) harvestOver++;
             else if (daysLeft === 0) harvestToday++;
             else if (daysLeft <= 3) harvestSoon++;
           }
         }
   
         const isNurseryFormal = (name === "22-1동");
         const isFullSpan = (name === "22-1동" && (zoneName === "B1" || zoneName === "B2") && fi >= 2);
         const gridClass = isFullSpan ? "cell-grid full-span" : "cell-grid";
         const plantLabel = isNurseryFormal ? "이식" : "정식";
         const harvestLabel = isNurseryFormal ? "정식" : "수확";
   
         html += `<td><div class="${gridClass}">
           <div class="cg cg-sow">
             <span class="cg-label">파종</span>
             <input class="date-md" type="text" inputmode="numeric" placeholder="MM/DD"
               data-f="${fi}" data-z="${zi}" data-field="sow" value="${sowMD}"
               onchange="onDateChange(this)" onblur="onDateChange(this)">
           </div>
           <div class="cg cg-days">
             <span class="cg-label">일수</span>
             ${cell.sow ? `<span class="days-badge ${cultCls}">${cultLabel}</span>` : '<span class="empty-mark">—</span>'}
           </div>
           <div class="cg cg-plant">
             <span class="cg-label">${plantLabel}</span>
             <input class="date-md" type="text" inputmode="numeric" placeholder="MM/DD"
               data-f="${fi}" data-z="${zi}" data-field="plant" value="${plantMD}"
               onchange="onDateChange(this)" onblur="onDateChange(this)">
           </div>
           <div class="cg cg-harvest">
             <span class="cg-label">${harvestLabel}</span>
             ${harvestStr
               ? `<span class="harvest-date ${harvCls}">${toMD(harvestStr)}</span>
                  <span class="days-badge ${badgeCls}">${dLabel}</span>`
               : '<span class="empty-mark">—</span>'}
           </div>
         </div></td>`;
       }
       html += "</tr>";
     }
     html += "</tbody>";
     table.innerHTML = html;
   
     let status = `<span><strong>${name}</strong> (${sheet.type})</span>
                   <span>입력: <strong>${filled}</strong> / ${totalCells}</span>`;
     if (name === "22-1동") {
       status += `<span>육묘일수: <strong>${nurseryDays}일</strong></span>
                  <span>이식일수: <strong>${transplantDays}일</strong></span>
                  <span>정식일 = 이식일 + ${transplantDays}일</span>`;
     } else {
       status += `<span>수확 임박(≤3일): <strong style="color:var(--orange)">${harvestSoon}</strong></span>
                  <span>오늘 수확: <strong style="color:var(--red)">${harvestToday}</strong></span>
                  <span>초과: <strong style="color:var(--red)">${harvestOver}</strong></span>
                  <span>재배기준: <strong>${dayLimit}일</strong></span>`;
     }
     document.getElementById("statusBar").innerHTML = status;
   }
   
   /* ---------- 일반 날짜 변경 ---------- */
   async function onDateChange(input) {
     const fi = +input.dataset.f;
     const zi = +input.dataset.z;
     const field = input.dataset.field;
     const raw = (input.value || "").trim();
     const sheet = data[currentSheet];
   
     if (!raw) {
       setCell(sheet, fi, zi, field, null);
       input.classList.remove("invalid");
       const c = cellOf(sheet, fi, zi);
       localBackup();
       await saveCellToDB(currentSheet, sheet.floors[fi], sheet.zones[zi], c.sow, c.plant);
       renderBoard(currentSheet);
       return;
     }
     const iso = parseMD(raw);
     if (!iso) { input.classList.add("invalid"); return; }
     input.classList.remove("invalid");
     setCell(sheet, fi, zi, field, iso);
     const c = cellOf(sheet, fi, zi);
     localBackup();
     await saveCellToDB(currentSheet, sheet.floors[fi], sheet.zones[zi], c.sow, c.plant);
     renderBoard(currentSheet);
   }
   
   /* ---------- B1/B2 좌우 셀 변경 ---------- */
   async function onSideChange(input) {
     const fi = +input.dataset.f;
     const zi = +input.dataset.z;
     const side = input.dataset.side;
     const ri = +input.dataset.r;
     const field = input.dataset.field;
     const sheet = data[currentSheet];
   
     if (!sheet.plants[fi]) {
       sheet.plants[fi] = sheet.zones.map(z =>
         isSideCell(currentSheet, z, fi) ? emptySideCell() : { sow: null, plant: null }
       );
     }
     if (!sheet.plants[fi][zi]?.left) {
       sheet.plants[fi][zi] = emptySideCell();
     }
   
     const slot = sheet.plants[fi][zi][side][ri];
   
     if (field === "sow") {
       const raw = (input.value || "").trim();
       if (!raw) {
         slot.sow = null;
         input.classList.remove("invalid");
       } else {
         const iso = parseMD(raw);
         if (!iso) { input.classList.add("invalid"); return; }
         input.classList.remove("invalid");
         slot.sow = iso;
       }
     } else if (field === "trays") {
       const v = input.value.trim();
       slot.trays = v === "" ? null : parseInt(v, 10);
     }
   
     localBackup();
     if (useDB) {
       try {
         await apiPost("/api/plant", {
           sheet: currentSheet, floor: fi, zone: zi,
           nursery: sheet.plants[fi][zi]
         });
       } catch (e) { console.error(e); }
     }
     renderBoard(currentSheet);
   }
   
   /* ---------- 일수 바인딩 ---------- */
   const bindDaysInput = (id, field, fallback) => {
     const el = document.getElementById(id);
     if (!el) return;
     el.addEventListener("change", () => {
       globalDays[field] = parseInt(el.value, 10) || fallback;
       saveGlobalDays();
       if (currentSheet) renderBoard(currentSheet);
     });
   };
   
   /* ---------- 작업 등록 ---------- */
   function plantLabelOf() {
     return currentSheet === "22-1동" ? "이식" : "정식";
   }
   
   function createWorkRegisterUI() {
     const toolbar = document.querySelector(".toolbar");
     if (!toolbar || document.getElementById("workRegisterBtn")) return;
   
     const btn = document.createElement("button");
     btn.id = "workRegisterBtn";
     btn.className = "btn";
     btn.textContent = "📋 작업 등록";
     btn.onclick = openWorkRegister;
   
     const saveBtn = toolbar.querySelector(".btn.primary");
     if (saveBtn?.nextSibling) toolbar.insertBefore(btn, saveBtn.nextSibling);
     else toolbar.prepend(btn);
   
     const modal = document.createElement("div");
     modal.id = "workRegisterModal";
     modal.innerHTML = `
       <div class="work-modal-backdrop"></div>
       <div class="work-modal">
         <div class="work-modal-header">
           <h2>📋 작업 등록</h2>
           <button type="button" class="work-modal-close" onclick="closeWorkRegister()">×</button>
         </div>
         <div class="work-modal-body">
           <div class="work-form-group">
             <label for="workZone">시작 행</label>
             <select id="workZone" onchange="updateWorkPreview()"></select>
           </div>
           <div class="work-form-group">
             <label for="workFloor">시작 층</label>
             <select id="workFloor" onchange="updateWorkPreview()"></select>
           </div>
           <div class="work-form-group">
             <label for="workCount">작업 수량</label>
             <div class="work-input-unit">
               <input type="number" id="workCount" min="1" max="1000" value="1" oninput="updateWorkPreview()">
               <span>항</span>
             </div>
           </div>
           <div class="work-form-group">
             <label>날짜 입력</label>
             <div class="work-date-row">
               <div class="work-date-item">
                 <label for="workSowDate">🌱 파종일</label>
                 <input type="text" id="workSowDate" inputmode="numeric" placeholder="MM/DD" oninput="updateWorkPreview()">
               </div>
               <div class="work-date-item">
                 <label for="workPlantDate">🌿 정식일</label>
                 <input type="text" id="workPlantDate" inputmode="numeric" placeholder="MM/DD" oninput="updateWorkPreview()">
               </div>
             </div>
           </div>
           <div class="work-preview">
             <div class="work-preview-title">적용 예정</div>
             <div id="workPreviewList" class="work-preview-list"></div>
             <div id="workPreviewSummary" class="work-preview-summary"></div>
           </div>
           <div id="workRegisterWarning" class="work-register-warning"></div>
         </div>
         <div class="work-modal-footer">
           <button type="button" class="btn" onclick="closeWorkRegister()">취소</button>
           <button type="button" class="btn primary" onclick="executeWorkRegister()">작업 등록</button>
         </div>
       </div>`;
     document.body.appendChild(modal);
     modal.querySelector(".work-modal-backdrop").onclick = closeWorkRegister;
     createWorkRegisterStyle();
   }
   
   function createWorkRegisterStyle() {
     if (document.getElementById("workRegisterStyle")) return;
     const style = document.createElement("style");
     style.id = "workRegisterStyle";
     style.textContent = `
       #workRegisterModal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center}
       #workRegisterModal.show{display:flex}
       .work-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(2px)}
       .work-modal{position:relative;z-index:1;width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
       .work-modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)}
       .work-modal-header h2{font-size:1.05rem;margin:0}
       .work-modal-close{border:none;background:transparent;color:var(--text-dim);font-size:1.8rem;line-height:1;cursor:pointer}
       .work-modal-close:hover{color:var(--text)}
       .work-modal-body{padding:20px}
       .work-form-group{margin-bottom:16px}
       .work-form-group>label{display:block;margin-bottom:7px;color:var(--text-dim);font-size:.82rem;font-weight:600}
       .work-form-group select,.work-form-group>input{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:.9rem;outline:none}
       .work-form-group select:focus,.work-form-group>input:focus{border-color:var(--accent)}
       .work-input-unit{display:flex;align-items:center;gap:8px}
       .work-input-unit input{width:120px;padding:10px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);text-align:center;font-size:1rem;font-weight:700}
       .work-input-unit span{color:var(--text-dim)}
       .work-preview{margin-top:20px;padding:14px;border:1px solid var(--border);border-radius:9px;background:var(--surface2)}
       .work-preview-title{margin-bottom:8px;font-size:.82rem;font-weight:700;color:var(--text-dim)}
       .work-preview-list{display:flex;flex-wrap:wrap;gap:5px;max-height:130px;overflow-y:auto}
       .work-preview-item{padding:4px 7px;border-radius:5px;background:var(--blue-bg);color:var(--text);font-size:.78rem;font-weight:600}
       .work-preview-item.exists{background:var(--red-bg);color:var(--red)}
       .work-preview-summary{margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:.8rem;color:var(--text-dim)}
       .work-register-warning{margin-top:12px;color:var(--red);font-size:.82rem;line-height:1.5}
       .work-modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)}
       @media(max-width:768px){.work-modal{width:calc(100vw - 20px)}}
     `;
     document.head.appendChild(style);
   }
   
   function openWorkRegister() {
     const modal = document.getElementById("workRegisterModal");
     if (!modal) {
       createWorkRegisterUI();
       return openWorkRegister();
     }
   
     const sheet = data[currentSheet];
     if (!sheet) return;
     const isNursery = currentSheet === "22-1동";
   
     const zoneSelect = document.getElementById("workZone");
     zoneSelect.innerHTML = "";
     sheet.zones.forEach((zone, i) => {
       const opt = document.createElement("option");
       opt.value = i;
       opt.textContent = zone;
       zoneSelect.appendChild(opt);
     });
   
     const floorSelect = document.getElementById("workFloor");
     floorSelect.innerHTML = "";
     sheet.floors.forEach((floor, i) => {
       const opt = document.createElement("option");
       opt.value = i;
       opt.textContent = floor;
       floorSelect.appendChild(opt);
     });
   
     zoneSelect.value = "0";
     floorSelect.value = isNursery ? "2" : "0";
     document.getElementById("workCount").value = "1";
     document.getElementById("workSowDate").value = "";
     document.getElementById("workPlantDate").value = toMD(todayStr());
   
     const plantLabel = document.querySelector('label[for="workPlantDate"]');
     if (plantLabel) plantLabel.textContent = isNursery ? "🌿 이식일" : "🌿 정식일";
   
     modal.classList.add("show");
     updateWorkPreview();
   }
   
   const closeWorkRegister = () => {
     document.getElementById("workRegisterModal")?.classList.remove("show");
   };
   
   function buildWorkPositions(sheet, startZoneIndex, startFloorIndex, count) {
     const positions = [];
     let zoneIndex = startZoneIndex;
     let floorIndex = startFloorIndex;
     let guard = 0;
   
     while (positions.length < count && guard < 500) {
       guard++;
       if (zoneIndex >= sheet.zones.length) break;
       if (floorIndex >= sheet.floors.length) {
         floorIndex = 0;
         zoneIndex++;
         continue;
       }
   
       const zone = sheet.zones[zoneIndex];
       if (!isSideCell(currentSheet, zone, floorIndex)) {
         positions.push({
           zoneIndex,
           floorIndex,
           zone,
           floor: sheet.floors[floorIndex]
         });
       }
   
       floorIndex++;
       if (floorIndex >= sheet.floors.length) {
         floorIndex = 0;
         zoneIndex++;
       }
     }
     return positions;
   }
   
   function updateWorkPreview() {
     if (!currentSheet) return;
     const sheet = data[currentSheet];
     if (!sheet) return;
   
     const zoneEl = document.getElementById("workZone");
     const floorEl = document.getElementById("workFloor");
     const countEl = document.getElementById("workCount");
     const sowEl = document.getElementById("workSowDate");
     const plantEl = document.getElementById("workPlantDate");
     const listEl = document.getElementById("workPreviewList");
     const summaryEl = document.getElementById("workPreviewSummary");
     const warningEl = document.getElementById("workRegisterWarning");
     if (!zoneEl || !floorEl || !countEl || !listEl) return;
   
     const zoneIndex = +zoneEl.value;
     const floorIndex = +floorEl.value;
     const count = +countEl.value || 0;
     const positions = buildWorkPositions(sheet, zoneIndex, floorIndex, count);
   
     listEl.innerHTML = "";
     warningEl.textContent = "";
     if (positions.length < count) {
       warningEl.textContent = "⚠️ 선택한 수량이 범위를 넘어갑니다. 가능한 항까지만 표시됩니다.";
     }
   
     const sowRaw = (sowEl?.value || "").trim();
     const plantRaw = (plantEl?.value || "").trim();
     const sowIso = sowRaw ? parseMD(sowRaw) : null;
     const plantIso = plantRaw ? parseMD(plantRaw) : null;
     const typeLabel = plantLabelOf();
   
     positions.forEach(pos => {
       const item = document.createElement("span");
       item.className = "work-preview-item";
       const cell = cellOf(sheet, pos.floorIndex, pos.zoneIndex);
       if ((sowIso && cell.sow) || (plantIso && cell.plant)) {
         item.classList.add("exists");
         let title = [];
         if (cell.sow) title.push("파종:" + toMD(cell.sow));
         if (cell.plant) title.push(typeLabel + ":" + toMD(cell.plant));
         item.title = "기존: " + title.join(" / ");
       }
       item.textContent = `${pos.zone}-${pos.floor}`;
       listEl.appendChild(item);
     });
   
     let parts = [];
     if (sowIso) parts.push("파종 " + toMD(sowIso));
     else if (sowRaw) parts.push("파종(형식오류)");
     if (plantIso) parts.push(typeLabel + " " + toMD(plantIso));
     else if (plantRaw) parts.push(typeLabel + "(형식오류)");
     if (parts.length === 0) parts.push("날짜 입력 필요");
   
     let existingCount = 0;
     positions.forEach(pos => {
       const cell = cellOf(sheet, pos.floorIndex, pos.zoneIndex);
       if ((sowIso && cell.sow) || (plantIso && cell.plant)) existingCount++;
     });
   
     let summary = parts.join(" + ") + ` / 총 ${positions.length}개`;
     if (existingCount > 0) summary += ` / 기존 입력 ${existingCount}개`;
     summaryEl.textContent = summary;
   }
   
   async function executeWorkRegister() {
     if (!currentSheet) return;
     const sheet = data[currentSheet];
     if (!sheet) return;
   
     const zoneIndex = +document.getElementById("workZone").value;
     const floorIndex = +document.getElementById("workFloor").value;
     const count = +document.getElementById("workCount").value;
     const sowRaw = (document.getElementById("workSowDate")?.value || "").trim();
     const plantRaw = (document.getElementById("workPlantDate")?.value || "").trim();
     const typeLabel = plantLabelOf();
   
     if (isNaN(zoneIndex) || isNaN(floorIndex)) {
       alert("시작 위치를 선택해주세요.");
       return;
     }
     if (!count || count < 1) {
       alert("작업 수량을 입력해주세요.");
       return;
     }
     if (!sowRaw && !plantRaw) {
       alert("파종일 또는 " + typeLabel + "일 중 하나 이상 입력해주세요.");
       return;
     }
   
     const sowIso = sowRaw ? parseMD(sowRaw) : null;
     const plantIso = plantRaw ? parseMD(plantRaw) : null;
     if (sowRaw && !sowIso) {
       alert("파종일을 MM/DD 형식으로 입력해주세요.");
       return;
     }
     if (plantRaw && !plantIso) {
       alert(typeLabel + "일을 MM/DD 형식으로 입력해주세요.");
       return;
     }
   
     const positions = buildWorkPositions(sheet, zoneIndex, floorIndex, count);
     if (!positions.length) {
       alert("등록할 수 있는 항이 없습니다.");
       return;
     }
   
     const existing = positions.filter(pos => {
       const cell = cellOf(sheet, pos.floorIndex, pos.zoneIndex);
       return (sowIso && cell.sow) || (plantIso && cell.plant);
     });
   
     if (existing.length > 0) {
       const preview = existing.slice(0, 8).map(pos => {
         const cell = cellOf(sheet, pos.floorIndex, pos.zoneIndex);
         let info = [];
         if (cell.sow) info.push("파종:" + toMD(cell.sow));
         if (cell.plant) info.push(typeLabel + ":" + toMD(cell.plant));
         return `${pos.zone}-${pos.floor} (${info.join(" ")})`;
       }).join("\n") + (existing.length > 8 ? "\n..." : "");
       if (!confirm(`이미 날짜가 있는 항이 ${existing.length}개 있습니다.\n\n${preview}\n\n기존 날짜를 덮어쓰시겠습니까?`)) return;
     }
   
     positions.forEach(pos => {
       if (sowIso) setCell(sheet, pos.floorIndex, pos.zoneIndex, "sow", sowIso);
       if (plantIso) setCell(sheet, pos.floorIndex, pos.zoneIndex, "plant", plantIso);
     });
     localBackup();
   
     if (useDB) {
       let failCount = 0;
       for (const pos of positions) {
         try {
           const cell = cellOf(sheet, pos.floorIndex, pos.zoneIndex);
           await saveCellToDB(currentSheet, pos.floor, pos.zone, cell.sow, cell.plant);
         } catch (e) { console.error(e); failCount++; }
       }
       showToast(failCount > 0 ? "일부 DB 저장 실패" : `${positions.length}개 작업 등록 완료`);
     } else {
       showToast(`${positions.length}개 작업 등록 완료`);
     }
   
     renderBoard(currentSheet);
     closeWorkRegister();
   }
   
   /* ---------- 초기화 ---------- */
   bindDaysInput("nurseryDays", "nurseryDays", 7);
   bindDaysInput("transplantDays", "transplantDays", 21);
   bindDaysInput("formalDays", "formalDays", 23);
   
   (async () => {
     loadGlobalDays();
     await loadData();
     createWorkRegisterUI();
     renderBoard(Object.keys(data)[0]);
   })();
   
   setInterval(() => {
     const el = document.getElementById("todayDisplay");
     if (el) el.textContent = todayStr();
     if (currentSheet) renderBoard(currentSheet);
   }, 60000);
