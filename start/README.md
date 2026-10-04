# KARETA Start Landing

Полностью изолированный публичный лендинг KARETA.KZ в папке `/start/`.

## Что изменено во второй версии

- старый тёмный demo-style landing полностью заменён;
- новый визуальный язык ближе к текущей KARETA: светлая база, белые карточки, оранжевый акцент, тёмный функциональный блок;
- используются реальные assets проекта:
  - `../assets/logo/main/kareta_logo_full.png`;
  - `../assets/onboarding/kareta_logo_icon.png`;
  - `../assets/onboarding/welcome_city_bg_orange.png`;
  - `../assets/onboarding/welcome_car.png`;
- отдельный `i18n.json` для RU / KK / EN;
- hero, «О проекте», «Как работает», возможности платформы и download-блок;
- responsive layout для desktop / tablet / mobile;
- мобильное меню и sticky header;
- Web CTA работает сразу;
- Android / iOS не получают выдуманных URL и до появления официальных ссылок показывают «Скоро».

## Файлы

- `index.html` — структура;
- `styles.css` — изолированный дизайн;
- `app.js` — i18n, меню, download-ссылки и UI-состояния;
- `i18n.json` — канонический словарь RU / KK / EN;
- `config.js` — ссылки Web / Android / iOS.

## Download config

```js
window.KARETA_START_CONFIG = Object.freeze({
  webUrl: "../",
  androidUrl: "",
  iosUrl: ""
});
```

После появления официальных Android / iOS URL достаточно заполнить соответствующие поля. Кнопки автоматически переходят из состояния «Скоро» в «Доступно».

## Проверено

- JS parse: PASS;
- JSON parse: PASS;
- 82 i18n-ключа × RU / KK / EN: PASS;
- mobile breakpoint: PASS;
- tablet breakpoint: PASS;
- все используемые KARETA asset paths существуют: PASS.

## Изоляция

Лендинг не меняет:

- корневой `index.php`;
- SPA router;
- Service Worker;
- asset manifest;
- API;
- DB;
- Android bridge.

Для перевода корневого домена на landing требуется отдельный интеграционный шаг после browser smoke.
