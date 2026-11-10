
"use strict";
(() => {
  const { text: t } = globalThis.KairoInventoryLocale;
  const adapter = globalThis.KairoInventoryAdapter;
  const sessions = new Map();
  const PREFIX = "kairo-inventory:";
  const emit = (player, name, data = {}) => player.emit(PREFIX + name, JSON.stringify(data));
  const identity = item => JSON.stringify(item.source === "custom"
    ? [item.source,item.slot,item.name] : [item.source,item.itemId,item.variation || "",item.holder || ""]);
  const short = (value, length) => String(value ?? "").slice(0,length);
  const errorMessage = error => short(error?.message || t("failed"),180);
  function live(session) { return sessions.get(session.player.id) === session; }
  function close(player) {
    const session = sessions.get(player.id);
    if (session) clearTimeout(session.timer);
    sessions.delete(player.id);
    emit(player,"close");
  }
  function presentation(player, row, readOnly, session) {
    const family = row.source === "native" ? adapter.mountFamily(row.itemId) : null;
    const equipped = !!row.equipped || !!family && /^active/i.test(row.holder || "");
    let action = "", secondary = "";
    if (!readOnly) {
      if (row.source === "native" && row.kind === "gear") {
        if (equipped && typeof player.gear?.unequip === "function") action = "Togli";
        else if (!equipped && row.identified && typeof player.gear?.equip === "function") action = "Indossa";
      } else if (family) {
        const canSelect = !equipped && (family === "broom" || session.mounts.includes(family));
        if ((family === "broom" || session.summons.includes(family)) && (equipped || canSelect)) action = "Usa";
        if (canSelect) {
          if (action) secondary = "Scegli";
          else action = "Scegli";
        }
      } else if (row.usable) action = "Usa";
    }
    const upstreamIcon = short(row.icon,240);
    const localPath = "fw://resources/hmp-inventory/dist/icons/";
    const category = String(row.category || "").toLowerCase();
    const fallback = row.kind === "gear" || row.kind === "mount" || row.kind === "tool" ? row.kind :
      /potion|pozione/.test(category) ? "potion" : /plant/.test(category) ? "plant" : /ingredient|forage|resource/.test(category) ? "ingredient" : "item";
    const icon = upstreamIcon.startsWith(localPath)
      ? "./icons/" + fallback + ".png" : upstreamIcon || "./icons/" + fallback + ".png";
    return {
      key: identity(row), label: short(row.label || row.itemId,100),
      description: short(row.description,180),
      icon,
      amount: row.amount, category: short(row.category,50), kind: row.kind, family, equipped, action, secondary
    };
  }
  function sendBatches(player, name, rows, batchSize) {
    for (let i=0;i<rows.length;i+=batchSize) emit(player,name,rows.slice(i,i+batchSize));
  }
  async function refresh(session) {
    if (!live(session)) return;
    if (session.loading) { session.dirty = true; return; }
    session.loading = true;
    try {
      const model = await adapter.read(session.player);
      if (!live(session)) return;
      const { player, rows } = session;
      const next = new Map();
      const changes = [];
      for (const row of model.items) {
        const item = presentation(player,row,model.readOnly,session);
        const encoded = JSON.stringify(item);
        next.set(item.key,encoded);
        if (rows.get(item.key) !== encoded) changes.push(item);
      }
      const removed = [...rows.keys()].filter(key=>!next.has(key));
      const status = {
        used: Array.isArray(model.custom) ? model.custom.length : null,
        slots: model.container?.slots ?? null,
        readOnly: !!model.readOnly
      };
      const statusKey = JSON.stringify(status);
      if (statusKey !== session.status) emit(player,"status",status);
      sendBatches(player,"remove",removed,50);
      sendBatches(player,"rows",changes,15);
      session.rows = next;
      session.status = statusKey;
      if (!session.shown) { session.shown = true; emit(player,"show"); }
    } catch (error) {
      if (live(session)) {
        session.player.sendChat("[" + t("title") + "] " + errorMessage(error));
        close(session.player);
      }
    } finally {
      session.loading = false;
      if (session.dirty) { session.dirty = false; schedule(session.player); }
    }
  }
  function schedule(player) {
    const session = player && sessions.get(player.id);
    if (!session || session.timer) return;
    session.timer = setTimeout(() => { session.timer = null; void refresh(session); },80);
  }
  function decode(raw) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || raw.length > 2048) return {};
    try { const value = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
  }
  async function act(player, raw) {
    const session = sessions.get(player.id);
    const { key, action } = decode(raw);
    if (!session?.shown) return;
    if (session.busy || typeof key !== "string" || key.length > 400 || !session.rows.has(key)) {
      emit(player,"error",{message:session.busy?t("busy"):t("gone")});
      emit(player,"action-done");
      return;
    }
    session.busy = true;
    try {
      const model = await adapter.read(player);
      if (!live(session)) return;
      const row = model.items.find(item => identity(item) === key);
      const allowed = row && presentation(player,row,model.readOnly,session);
      if (!allowed || model.readOnly || !action || action !== allowed.action && action !== allowed.secondary) {
        throw Error(t("changed"));
      }
      const family = row.source === "native" ? adapter.mountFamily(row.itemId) : null;
      if (action === "Usa" && family) {
        emit(player,"use-mount",{ family, itemId:row.itemId, select:!allowed.equipped });
      } else if (action === "Usa") {
        await model.backend.use(player,row.source === "custom" ? row.slot : { source:"native",itemId:row.itemId,variation:row.variation || "" });
      } else if (action === "Scegli") {
        emit(player,"select-mount",{ family:adapter.mountFamily(row.itemId), itemId:row.itemId });
      } else await adapter.gearAction(player,row);
    } catch (error) {
      if (live(session)) emit(player,"error",{ message:errorMessage(error) });
    } finally {
      session.busy = false;
      if (live(session)) { emit(player,"action-done"); schedule(player); }
    }
  }
  Events.onClient(PREFIX+"open",(player,raw)=>{
    if (sessions.has(player.id)) return;
    const { mounts, summons } = decode(raw);
    const families = values => ["broom","ground","flying"].filter(name=>Array.isArray(values)&&values.includes(name));
    const session = { player, mounts:families(mounts), summons:families(summons), rows:new Map() };
    sessions.set(player.id,session);
    emit(player,"reset");
    void refresh(session);
  });
  Events.onClient(PREFIX+"close",player=>close(player));
  Events.onClient(PREFIX+"action",act);
  Events.on("playerInventoryUpdated",schedule);
  Events.on("playerGearChanged",schedule);
  Events.on("hmp:inventory:changed",payload=>schedule(payload?.player));
  Events.on("hmp:character:unloading",({session})=>{ if (session?.player && sessions.has(session.player.id)) close(session.player); });
  Events.on("playerDisconnect",player=>{
    const session=sessions.get(player.id);
    if (session) clearTimeout(session.timer);
    sessions.delete(player.id);
  });
  Events.on("chatCommand",async (player,_message,command)=>{
    const name = String(command).toLowerCase();
    if (name === "inventory" || name === "hmpinv") {
      emit(player,"open-request");
      return;
    }
    if (name !== "borsa") return;
    try {
      const model=await adapter.read(player);
      const names=model.items.slice(0,20).map(item=>short(item.label || item.itemId,42)+" ×"+item.amount);
      player.sendChat("[" + t("title") + "] "+(model.readOnly ? (t("readOnly") + ". ") : "")+(names.join(", ")||t("empty")));
      if (model.items.length>20) player.sendChat("[" + t("title") + "] " + t("summary",{total:model.items.length}));
    } catch (error) { player.sendChat("[" + t("title") + "] "+errorMessage(error)); }
  });
  Events.on("resourceStop",name=>{if (!name||name==="kairo-inventory") for (const session of sessions.values()) close(session.player);});
})();
