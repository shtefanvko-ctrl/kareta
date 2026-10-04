(function () {
  "use strict";

  var config = window.KARETA_START_CONFIG || {};
  var dictionary = null;
  var activeLang = "ru";
  var installPrompt = null;

  function getSavedLanguage() {
    try {
      var saved = localStorage.getItem("kareta.start.lang");
      return saved === "ru" || saved === "kk" || saved === "en" ? saved : "ru";
    } catch (_error) {
      return "ru";
    }
  }

  function setSavedLanguage(lang) {
    try { localStorage.setItem("kareta.start.lang", lang); } catch (_error) {}
  }

  function textFor(key) {
    if (!dictionary || !dictionary[activeLang]) return "";
    return String(dictionary[activeLang][key] || "");
  }

  function applyLanguage(lang) {
    if (!dictionary || !dictionary[lang]) return;
    activeLang = lang;
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      var value = dictionary[lang][key];
      if (typeof value === "string") node.textContent = value;
    });

    document.querySelectorAll("[data-lang]").forEach(function (button) {
      var selected = button.getAttribute("data-lang") === lang;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });

    var meta = dictionary[lang]._meta || {};
    if (meta.title) document.title = meta.title;
    var description = document.querySelector('meta[name="description"]');
    if (description && meta.description) description.setAttribute("content", meta.description);

    setSavedLanguage(lang);
    refreshDownloadLinks();
  }

  function configureLink(link, url, platform) {
    var status = link.querySelector("[data-status]");
    if (url) {
      link.href = url;
      link.removeAttribute("aria-disabled");
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      if (status) {
        status.textContent = textFor("available") || "Available";
        status.classList.add("is-ready");
      }
      return;
    }

    link.href = "#download";
    link.setAttribute("aria-disabled", "true");
    if (status) {
      status.textContent = textFor("comingSoon") || "Soon";
      status.classList.remove("is-ready");
    }
  }

  function refreshDownloadLinks() {
    document.querySelectorAll('[data-download="android"]').forEach(function (link) {
      configureLink(link, String(config.androidUrl || ""), "android");
    });
    document.querySelectorAll('[data-download="ios"]').forEach(function (link) {
      configureLink(link, String(config.iosUrl || ""), "ios");
    });
    document.querySelectorAll("[data-web-link]").forEach(function (link) {
      link.href = String(config.webUrl || "../");
    });
  }

  function bindDisabledStoreLinks() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest('[data-download][aria-disabled="true"]');
      if (!link) return;
      event.preventDefault();
      document.querySelector("#download")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function bindLanguageButtons() {
    document.querySelectorAll("[data-lang]").forEach(function (button) {
      button.addEventListener("click", function () {
        applyLanguage(button.getAttribute("data-lang"));
      });
    });
  }

  function bindMobileMenu() {
    var toggle = document.querySelector("[data-menu-toggle]");
    var menu = document.querySelector("[data-mobile-menu]");
    if (!toggle || !menu) return;

    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
  }

  function bindHeaderState() {
    var header = document.querySelector("[data-header]");
    if (!header) return;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 10);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function bindPwaInstall() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      installPrompt = event;
    });

    document.addEventListener("click", async function (event) {
      var trigger = event.target.closest("[data-pwa-install]");
      if (!trigger || !installPrompt) return;
      event.preventDefault();
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
      } catch (_error) {}
      installPrompt = null;
    });
  }

  async function loadDictionary() {
    try {
      var response = await fetch("./i18n.json", { cache: "no-store" });
      if (!response.ok) throw new Error("i18n_http_" + response.status);
      dictionary = await response.json();
      applyLanguage(getSavedLanguage());
    } catch (error) {
      console.warn("[KARETA start] i18n unavailable; keeping default RU copy", error);
      activeLang = "ru";
      refreshDownloadLinks();
    }
  }

  var year = document.querySelector("[data-current-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  bindDisabledStoreLinks();
  bindLanguageButtons();
  bindMobileMenu();
  bindHeaderState();
  bindPwaInstall();
  refreshDownloadLinks();
  loadDictionary();
})();