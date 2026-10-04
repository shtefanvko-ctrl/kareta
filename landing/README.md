# KARETA Landing — real project assets

Самодостаточный лендинг в папке `/landing/`.

## Главное правило

Лендинг не рисует поддельные экраны и не использует сторонние иконки. Внутрь `landing/assets/` скопированы точные Git blobs из KARETA.

### Логотипы
- `assets/logo/main/kareta_logo_full.png` → `landing/assets/logo/kareta_logo_full.png`
- `assets/onboarding/kareta_logo_icon.png` → `landing/assets/logo/kareta_logo_icon.png`

### Реальные скриншоты интерфейса
- desktop: `docs/desktop-adaptation/188.5.5.6.84.114/home/home__client__1440x900__chrome__84_114.jpg`
- mobile: `docs/desktop-adaptation/188.5.5.6.84.114/home/mobile-regression/home__client__390x844__chrome__mobile-regression.jpg`

### Иконки
Используются исходные SVG из `assets/icons/tabler/`: search, tool, package, car-garage, device-desktop, shield-check, check.

### Store badges
Используются существующие:
- `print-banners/assets/stores/google-play.png`
- `print-banners/assets/stores/app-store.png`

## Структура
- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `i18n.json`
- `assets/`

## Download URLs
```js
window.KARETA_LANDING_CONFIG=Object.freeze({
  webUrl:"../",
  androidUrl:"",
  iosUrl:""
});
```

Android/iOS URL не выдумываются. Пока они пустые, store-badges показывают «Скоро».

## Изоляция
Папка `landing/` не меняет SPA, router, API, DB, Service Worker или Android bridge.
