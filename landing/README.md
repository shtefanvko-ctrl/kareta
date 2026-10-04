# KARETA Landing — real project assets

Самодостаточный лендинг в папке `/landing/`.

## Главное правило

Лендинг не рисует поддельные экраны и не использует сторонние иконки. Внутрь `landing/assets/` скопированы точные Git blobs из KARETA.

### Логотипы
- `assets/logo/main/kareta_logo_full.png` → `landing/assets/logo/kareta_logo_full.png`
- `assets/onboarding/kareta_logo_icon.png` → `landing/assets/logo/kareta_logo_icon.png`

### Фирменные responsive-фоны
- `assets/onboarding/backgrounds/welcome/city-calm/city-calm-desktop-standard.png` → `landing/assets/backgrounds/city-calm-desktop.png`
- `assets/onboarding/backgrounds/welcome/city-calm/city-calm-mobile.png` → `landing/assets/backgrounds/city-calm-mobile.png`
- `assets/onboarding/backgrounds/welcome/road-assist/road-assist-desktop-standard.png` → `landing/assets/backgrounds/road-assist-desktop.png`
- `assets/onboarding/backgrounds/welcome/road-assist/road-assist-mobile.png` → `landing/assets/backgrounds/road-assist-mobile.png`
- `assets/onboarding/backgrounds/welcome/service-map/service-map-desktop-standard.png` → `landing/assets/backgrounds/service-map-desktop.png`
- `assets/onboarding/backgrounds/welcome/service-map/service-map-mobile.png` → `landing/assets/backgrounds/service-map-mobile.png`

Hero использует большой полный `kareta_logo_full.png`, а не только иконку.

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
