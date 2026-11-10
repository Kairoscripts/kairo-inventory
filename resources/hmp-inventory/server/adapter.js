
"use strict";
globalThis.KairoInventoryAdapter = (() => {
  const { text: t } = globalThis.KairoInventoryLocale;
  function optional(name) {
    try { return Imports.get(name); } catch { return null; }
  }
  function mountFamily(id) {
    if (/^broom/i.test(id)) return "broom";
    if (/^(onyxhippogriff|hippogriff|thestral)mount$/i.test(id)) return "flying";
    if (/^graphornmount$/i.test(id)) return "ground";
    return null;
  }
  function nativeRows(player) {
    try { return player.inventory?.list?.() || []; } catch { return []; }
  }
  async function read(player) {
    const core = optional("hmp-core");
    if (core?.characters?.active && !core.characters.active(player)) throw Error(t("character"));
    const backend = globalThis.KairoInventoryStorage?.inventory;
    if (backend?.get) {
      try {
        const model = await backend.get(player);
        if (Array.isArray(model?.items)) return { ...model, readOnly: !backend.use, backend };
      } catch (error) {
        console.warn("[kairo-inventory] Archivio non disponibile: " + String(error?.message || error));
      }
    }
    return {
      readOnly: true,
      items: nativeRows(player).map(row => ({
        source: "native", itemId: row.itemId, label: row.itemId,
        amount: row.count, kind: row.kind, holder: row.holder,
        variation: row.variation, equipped: row.equipped, usable: false
      }))
    };
  }
  function gearAction(player, row) {
    const gear = player.gear;
    const variation = row.variation || "";
    let invoke;
    if (row.equipped && typeof gear?.unequip === "function" && typeof gear.equipped === "function") {
      const worn = gear.equipped() || {};
      const slot = Object.keys(worn).find(key => worn[key]?.itemId === row.itemId && (worn[key]?.variation || "") === variation);
      if (!slot) throw Error(t("notWorn"));
      invoke = callback => gear.unequip(slot, callback);
    } else if (!row.equipped && row.identified && typeof gear?.equip === "function") {
      invoke = callback => gear.equip(row.itemId, variation ? { variation } : {}, callback);
    } else throw Error(t("gearUnavailable"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(t("gearTimeout"))), 4500);
      try {
        invoke(error => {
          clearTimeout(timer);
          if (error) reject(Error(t("gearRejected")));
          else resolve();
        });
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  return Object.freeze({ optional, read, gearAction, mountFamily });
})();
