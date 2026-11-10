"use strict";
{
  const languages = globalThis.KairoInventoryLanguages;
  const requested = String(globalThis.KairoInventoryConfig.language ?? "it");
  const selected = Object.hasOwn(languages, requested) ? requested : "it";
  const messages = Object.freeze({ ...languages.it, ...languages[selected] });
  globalThis.KairoInventoryLocale = Object.freeze({
    language: selected,
    messages,
    text: (key, values = {}) => (messages[key] ?? key).replace(
      /\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder
    )
  });
}
