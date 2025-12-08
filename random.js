document.addEventListener("DOMContentLoaded", function () {

  /************** LeanCloud 初始化 **************/
  AV.init({
    appId: "awjrq2pnF6yDBX2QT7Sq1dHQ-gzGzoHsz",
    appKey: "WY6uq9q4hPthkwKX5JIHrlYk",
    serverURL: "https://awjrq2pn.lc-cn-n1-shared.com"
  });

  const NameList = AV.Object.extend("NameList");
  const DrawResult = AV.Object.extend("DrawResult");

  const ROOM_ID = "default_room";

  /************** DOM 元素 **************/
  const nameListContainer = document.getElementById("nameList");
  const addMyNameBtn = document.getElementById("addMyNameBtn");
  const drawBtn = document.getElementById("drawBtn");
  const clearNamesBtn = document.getElementById("clearNamesBtn");
  const winnersDiv = document.getElementById("winners");
  const slots = document.getElementById("slots");
  const countInput = document.getElementById("countInput");
  const 公示Container = document.getElementById("publicResults");
  const logDiv = document.getElementById("logArea");

  /************** 日志 **************/
  function log(msg) {
    if (logDiv) {
      logDiv.innerHTML = msg;
    }
  }

  /************** UUID（每个用户唯一识别） **************/
  let myUUID = localStorage.getItem("myUUID");
  if (!myUUID) {
    myUUID = "u_" + crypto.randomUUID();
    localStorage.setItem("myUUID", myUUID);
  }

  /************** 我的提交记录（本地） **************/
  let mySubmittedName = JSON.parse(localStorage.getItem("mySubmittedName") || "null");

  /************** 根据记录渲染名单 **************/
  function renderNameList(records) {
    nameListContainer.innerHTML = "";

    if (records.length === 0) {
      nameListContainer.innerHTML = '<div class="text-muted py-3">暂无名单</div>';
      return;
    }

    records.forEach(record => {
      const name = record.get("name");
      const uuid = record.get("uuid");
      const isMine = uuid === myUUID;

      const item = document.createElement("div");
      item.className = "flex items-center justify-between py-2 border-b border-dark-700";

      item.innerHTML = `
        <span class="${isMine ? "text-primary font-bold" : ""}">${name}</span>
        ${isMine
          ? `<div class="flex items-center gap-2">
               <button class="editBtn text-xs px-2 py-1 bg-secondary/20 rounded">编辑</button>
               <button class="deleteBtn text-xs px-2 py-1 bg-red-500/20 rounded">删除</button>
             </div>`
          : ""
        }
      `;

      if (isMine) {
        item.querySelector(".editBtn").addEventListener("click", () => editName(record));
        item.querySelector(".deleteBtn").addEventListener("click", () => deleteName(record));
      }

      nameListContainer.appendChild(item);
    });
  }
  /************** 加载名单（最终修复版） **************/
  async function loadNames() {
    const query = new AV.Query("NameList");
    query.equalTo("room", ROOM_ID);
    query.ascending("createdAt");
    const records = await query.find();

    /***** ★ 自动处理 mySubmittedName 与数据库不一致的问题 *****/

    if (!mySubmittedName) {
      // ① 本地无记录 → 尝试通过 uuid 找回
      const mine = records.find(r => r.get("uuid") === myUUID);
      if (mine) {
        mySubmittedName = {
          name: mine.get("name"),
          objectId: mine.id
        };
        localStorage.setItem("mySubmittedName", JSON.stringify(mySubmittedName));
        log("🔗 已根据 uuid 自动恢复你的名字");
      }
    } else {
      // ② 本地有记录 → 验证是否还在数据库中
      const mineById = records.find(r => r.id === mySubmittedName.objectId);

      if (mineById) {
        // 若记录存在但未绑定 uuid → 自动补上（修复旧数据）
        if (!mineById.get("uuid") || mineById.get("uuid") !== myUUID) {
          try {
            mineById.set("uuid", myUUID);
            await mineById.save();
            log("♻️ 自动修复：为你的名字补上 uuid 绑定");
          } catch (err) {
            log("⚠ 自动修复 uuid 失败：" + err.message);
          }
        }
      } else {
        // 记录不存在（被房主清空/删除）→ 清除本地缓存，允许重新提交
        mySubmittedName = null;
        localStorage.removeItem("mySubmittedName");
        log("ℹ️ 你的名字已不在数据库中，已清除本地状态，可重新提交");
      }
    }

    // ③ 渲染列表
    renderNameList(records);
    log(`📋 名单已同步，共 ${records.length} 个名字`);
  }

  loadNames();


  /************** 渲染抽签历史 **************/
  function renderDrawResults(records) {
    公示Container.innerHTML = "";

    if (records.length === 0) {
      公示Container.innerHTML = '<div class="text-muted py-3">暂无抽签记录</div>';
      return;
    }

    records.reverse().forEach(record => {
      const winners = record.get("winners");
      const count = record.get("count");
      const t = new Date(record.createdAt);
      const tStr = `${t.toLocaleDateString()} ${t.toLocaleTimeString().slice(0, 8)}`;

      const item = document.createElement("div");
      item.className = "py-2 px-2 border-b border-dark-700";

      item.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-muted">${tStr} · 抽取 ${count} 人</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${winners.map(name => `
            <span class="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">${name}</span>
          `).join("")}
        </div>
      `;

      公示Container.appendChild(item);
    });
  }

  async function loadDrawResults() {
    const query = new AV.Query("DrawResult");
    query.equalTo("room", ROOM_ID);
    query.ascending("createdAt");

    const records = await query.find();
    renderDrawResults(records);
  }

  loadDrawResults();


  /************** LeanCloud 实时同步 **************/
  async function enableRealtime() {
    const q1 = new AV.Query("NameList").equalTo("room", ROOM_ID);
    const live1 = await q1.subscribe();
    live1.on("create", loadNames);
    live1.on("delete", loadNames);
    live1.on("update", loadNames);

    const q2 = new AV.Query("DrawResult").equalTo("room", ROOM_ID);
    const live2 = await q2.subscribe();
    live2.on("create", loadDrawResults);

    log("🔄 已开启实时同步");
  }

  enableRealtime();
  /************** 添加名字（最终修复版） **************/
  addMyNameBtn.addEventListener("click", async () => {

    /***** 先验证本地 mySubmittedName 是否有效 *****/
    if (mySubmittedName) {
      try {
        const q = new AV.Query("NameList");
        const record = await q.get(mySubmittedName.objectId).catch(() => null);

        if (record) {
          // 若记录存在且 uuid 属于你 → 确实已经提交过
          if (record.get("uuid") === myUUID) {
            alert(`⚠️ 你已提交过名字：${mySubmittedName.name}`);
            return;
          } else {
            // 若记录存在但 uuid 不属于你 → 清除本地缓存（历史数据导致）
            mySubmittedName = null;
            localStorage.removeItem("mySubmittedName");
            log("ℹ️ 本地数据与数据库不一致，已清除缓存，可重新提交");
          }
        } else {
          // 记录已不存在（被房主清空）→ 清理本地
          mySubmittedName = null;
          localStorage.removeItem("mySubmittedName");
          log("ℹ️ 你的名字在数据库中不存在，已清除本地缓存");
        }
      } catch (err) {
        mySubmittedName = null;
        localStorage.removeItem("mySubmittedName");
      }
    }

    /***** 进入提交流程（此时 mySubmittedName 为 null） *****/
    const name = prompt("请输入你的名字：");
    if (!name || !name.trim()) {
      alert("名字不能为空！");
      return;
    }
    const trimmed = name.trim();

    // 不允许同名
    const query = new AV.Query("NameList");
    query.equalTo("room", ROOM_ID);
    query.equalTo("name", trimmed);
    const exists = await query.find();
    if (exists.length > 0) {
      alert("❌ 该名字已存在！");
      return;
    }

    // 创建新记录
    const obj = new NameList();
    obj.set("room", ROOM_ID);
    obj.set("name", trimmed);
    obj.set("uuid", myUUID); // ★ 绑定设备身份

    const saved = await obj.save();

    // 保存到本地
    mySubmittedName = {
      name: trimmed,
      objectId: saved.id
    };
    localStorage.setItem("mySubmittedName", JSON.stringify(mySubmittedName));

    log(`➕ 添加了名字：${trimmed}`);
    loadNames();
  });


  /************** 编辑名字 **************/
  async function editName(record) {
    const oldName = record.get("name");
    const newName = prompt("请输入新名字：", oldName);
    if (!newName || !newName.trim()) return;

    const trimmed = newName.trim();

    // 检查重名
    const q = new AV.Query("NameList");
    q.equalTo("room", ROOM_ID);
    q.equalTo("name", trimmed);
    const same = await q.find();

    const duplicate = same.some(r => r.id !== record.id);
    if (duplicate) {
      alert("❌ 已存在相同的名字");
      return;
    }

    record.set("name", trimmed);
    await record.save();

    if (mySubmittedName && mySubmittedName.objectId === record.id) {
      mySubmittedName.name = trimmed;
      localStorage.setItem("mySubmittedName", JSON.stringify(mySubmittedName));
    }

    log(`✏️ 修改名字：${oldName} → ${trimmed}`);
    loadNames();
  }


  /************** 删除名字 **************/
  async function deleteName(record) {
    const name = record.get("name");
    if (!confirm(`确定删除「${name}」吗？`)) return;

    await record.destroy();

    // 若删除的是我自己，清除本地记录
    if (mySubmittedName && mySubmittedName.objectId === record.id) {
      mySubmittedName = null;
      localStorage.removeItem("mySubmittedName");
    }

    log(`🗑 删除了名字：${name}`);
    loadNames();
  }


  /************** 房主清空所有记录 **************/
  clearNamesBtn.addEventListener("click", async () => {
    if (!isOwner) return;
    if (!confirm("⚠ 真的要清空所有名单和抽签记录吗？")) return;

    try {
      const list = await new AV.Query("NameList").equalTo("room", ROOM_ID).find();
      const draws = await new AV.Query("DrawResult").equalTo("room", ROOM_ID).find();

      await AV.Object.destroyAll(list);
      await AV.Object.destroyAll(draws);

      // 当前用户也需要清空本地记录
      mySubmittedName = null;
      localStorage.removeItem("mySubmittedName");

      slots.innerHTML = "";
      winnersDiv.innerHTML = "";

      loadNames();
      loadDrawResults();

      log("🗑 已清空所有记录");
    } catch (e) {
      log("❌ 清空失败：" + e.message);
    }
  });


  /************** 抽签辅助函数 **************/
  function displaySlots(n) {
    slots.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const div = document.createElement("div");
      div.className = "h-14 flex items-center justify-center rounded-lg bg-dark-900 border border-dark-700";
      div.textContent = "等待抽签...";
      slots.appendChild(div);
    }
  }

  function shuffle(arr) {
    let a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function getCurrentNameList() {
    const q = new AV.Query("NameList");
    q.equalTo("room", ROOM_ID);
    const rec = await q.find();
    return rec.map(r => r.get("name"));
  }


  /************** 保存抽签结果 **************/
  async function saveDrawResult(winners, count) {
    const obj = new DrawResult();
    obj.set("room", ROOM_ID);
    obj.set("winners", winners);
    obj.set("count", count);
    await obj.save();
  }


  /************** 抽签动画 **************/
  function animateReveal(names, count) {
    const slotEls = Array.from(slots.children);
    winnersDiv.innerHTML = "";

    slotEls.forEach((el, idx) => {
      let rounds = 25, r = 0;

      getCurrentNameList().then(pool => {
        const timer = setInterval(() => {
          el.textContent = pool[Math.floor(Math.random() * pool.length)] || "—";
          if (++r >= rounds) {
            clearInterval(timer);
            el.textContent = names[idx];
            el.classList.add("text-primary");

            const pill = document.createElement("span");
            pill.className = "px-3 py-1 bg-secondary/20 rounded text-secondary mr-2";
            pill.textContent = `${idx + 1}. ${names[idx]}`;
            winnersDiv.appendChild(pill);

            if (idx === slotEls.length - 1) {
              saveDrawResult(names, count);
            }
          }
        }, 50);
      });
    });
  }


  /************** 房主点击抽签 **************/
  drawBtn.addEventListener("click", async () => {
    if (!isOwner) {
      alert("只有房主可抽签");
      return;
    }

    const pool = await getCurrentNameList();
    if (pool.length === 0) {
      alert("名单为空");
      return;
    }

    const n = Math.max(1, parseInt(countInput.value));
    if (n > pool.length) {
      alert(`抽取人数不能超过 ${pool.length}`);
      return;
    }

    displaySlots(n);
    const winners = shuffle(pool).slice(0, n);
    animateReveal(winners, n);
  });

});
