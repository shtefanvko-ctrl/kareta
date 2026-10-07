# KARETA.KZ — Brand & Design Canon v3

Статус: WORKING CANON  
Область: Brand + Web/PWA + Android/iOS + SMM + advertising  
Источник технической геометрии: Git runtime contracts.

## 1. Brand core

**Brand Essence:** Всё для автомобиля — в одной KARETA.

**Позиционирование:** единая автомобильная платформа Казахстана: мастера и СТО, заявки, запчасти, диагностика и история автомобиля в одном связанном сценарии.

**Обещание:** от запроса до результата без потери контекста; действия и история связаны с автомобилем пользователя.

**Характер:** понятный, надёжный, технологичный, спокойный.

**Языки:** RU / KK / EN.

### Аудитории

- Автовладелец: быстро найти исполнителя, получить понятную цену/статус, сохранить историю автомобиля.
- Частный мастер: получать заявки, показывать компетенции, управлять работой и репутацией.
- СТО: заявки, загрузка постов/мастеров, статусы работ, диагностика, расписание.
- Продавец запчастей: каталог и предложения внутри автомобильного сценария.
- Партнёр: единые правила использования бренда без самодеятельности.

## 2. Logo canon

Канонический полный логотип в Git:

`assets/logo/main/kareta_logo_full.png`

App icon / fallback:

`assets/onboarding/kareta_logo_icon.png`

Логотип неизменяем: знак автомобиля с ключом, вертикальный разделитель, `KARETA.KZ`, подпись «АВТОСЕРВИС».

### Правила

- Не растягивать и не менять пропорции.
- Не менять фирменные цвета.
- Не добавлять glow, outline, bevel и декоративные тени.
- Не ставить на пёстрый или низкоконтрастный фон.
- Пока отдельная белая версия не утверждена, на тёмном фоне использовать светлую плашку.
- Защитное поле: минимум высота буквы K.
- Полный логотип: минимум 120 px на экране / 30 мм в печати; ниже — знак.

## 3. Brand color

### Бренд

- Brand Primary: `#FF6B00`
- Brand Text on light: `#C2410C`
- Brand Secondary / graphite: `#444444`
- Ink: `#111827`

### Semantic

- Page: `#F5F6F8`
- Surface/Card: `#FFFFFF`
- Line: `#E4E7EC`
- Muted: `#667085`
- Success: `#067647`
- Warning: `#B54708`
- Danger: `#B42318`
- Info: `#175CD3`

### Accessibility

`#FF6B00` не используется как мелкий текст на белом. Белый текст на `#FF6B00` не считать базовой AA-комбинацией. Для primary CTA допускается тёмный Ink-текст либо отдельный более тёмный semantic action token после проверки контраста.

## 4. Geometry — Git canon

Brandbook не вводит собственную параллельную геометрию. Базовая шкала берётся из `css/next/design_contract.css`:

- radius xs: 5 px
- control: 10 px
- card: 18 px
- dialog: 24 px
- spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 px
- content max: 1480 px
- page gutter: `clamp(16px, 2vw, 32px)`

Важно: историческая версия 8/12/20 сохранена только в archive. Новая брендовая документация следует runtime-контракту Git.

Role/surface-файлы могут иметь переходные aliases/legacy assertions, но не должны становиться вторым глобальным каноном.

## 5. Typography

Основная UI-семья: Inter с fallback `Segoe UI, system-ui, sans-serif`.

Рекомендуемая брендовая шкала:

| Role | Size / line-height | Weight |
| --- | --- | --- |
| Display | 44 / 48 | 800 |
| H1 | 32 / 38 | 800 |
| H2 | 24 / 30 | 700 |
| H3 | 20 / 26 | 700 |
| H4 | 17 / 24 | 600 |
| Body Large | 18 / 28 | 400 |
| Body | 16–17 / 24 | 400 |
| Body Small | 14 / 20 | 400 |
| Caption / Label | 12–13 / 16 | 500–600 |
| Button / Navigation | 16 / 20 | 600 |

Для runtime-компонентов ролевые foundation-файлы могут задавать плотность ниже, но брендбук фиксирует правило: критический пользовательский текст на мобильном не должен деградировать до 10–11 px.

## 6. UI language

Один визуальный язык для Client / Master / STO / Seller. Роли различаются задачами и semantic accents, но не получают отдельную независимую дизайн-систему.

### Компоненты

- Topbar / shell header
- Desktop side navigation
- Bottom navigation
- Search block
- Filters / chips
- Buttons
- Inputs / selects / switches
- Cards
- Lists / tables
- Modals / drawers
- Toast / empty state / skeleton
- Map surfaces
- Vehicle profile
- Orders / exchange cards
- Service / master / STO / parts cards

### Buttons

Варианты: primary, secondary, tertiary/ghost, danger, icon, CTA.

Состояния: default, hover, active, focus-visible, disabled, loading.

Pill geometry не используется как универсальная форма. Полный радиус — только там, где это несёт смысл: toggle, avatar, компактный status chip.

## 7. Status language

Цвет не является единственным носителем статуса. Всегда использовать текст + при необходимости icon/shape.

### Master availability

- Открыто
- Занято
- Выходной

### Order lifecycle

Создана → Биржа → Отклик → Принято → Диагностика → Согласование → В работе → Готово → Отчёт → Подтверждение → Отзыв.

Отмена и ошибка — отдельные terminal/error states, а не вариации warning.

## 8. Vehicle identity

Карточка автомобиля — цифровой профиль, а не декоративная карточка.

Обязательные слои:
- марка / модель / поколение;
- год / кузов;
- VIN (опционально до подтверждения);
- пробег;
- история ремонта;
- диагностика;
- OBD;
- документы / QR;
- связанные заявки.

## 9. VIN / QR / OBD

Scanner, VIN, QR и ELM327/OBD визуально принадлежат общей системе KARETA.

Принципы:
- один тип scanner surface;
- одинаковая структура permission/error/retry states;
- ошибки OBD не оформляются как рекламные карточки;
- результат диагностики всегда связан с vehicleId после подтверждения автомобиля;
- технические данные отделяются от пользовательского объяснения.

## 10. GEO / Maps

Единые типы точек:
- клиент;
- мастер;
- СТО;
- магазин;
- выбранная точка;
- недоступная точка;
- cluster;
- current location.

Map controls используют те же radius, line, typography и elevation tokens, что и остальной UI.

Город и GEO — semantic data, а не декоративный фильтр: default city пользователя, явное переключение, единый city ID.

## 11. Responsive canon

Mobile-first, но desktop не является растянутой мобильной страницей.

- Mobile: touch targets минимум 44 px; bottom navigation; двухколоночные каталоги только там, где карточка сохраняет читаемость.
- Tablet: промежуточная компоновка без искусственного «телефона в центре».
- Desktop: sidebar/header + расширенная контентная область.
- Wide desktop: content max и gutters регулируются общими layout tokens.

## 12. Motion

Базовые значения:
- fast: 120 ms
- base: 200 ms
- slow: 320 ms
- standard easing: `cubic-bezier(.2,0,0,1)`

Motion функционален: навигация, feedback, modal/drawer, loading/skeleton. Декоративная анимация не должна тормозить сценарий.

## 13. Photography / Art direction

- Фото соответствует конкретной услуге.
- Не повторять одно фото для несвязанных категорий.
- Не использовать transparent-grid / техническую заглушку в production.
- Placeholder единый и брендовый.
- Реальные автомобили, мастера, СТО, диагностика; без дешёвого stock-пафоса.

## 14. Iconography

Один icon family, одна толщина stroke и единая сетка.

Базовый принцип: outline в обычном состоянии, filled/strong только для active/selected, если это поддерживает конкретный набор.

Ключевые понятия не должны делить одну и ту же иконку: диагностика, тормоза, стартер, кондиционер, электрика — отдельные символы.

## 15. Themes

Light — базовая тема.

Dark использует отдельные semantic surfaces, не инверсию «в лоб».

Ориентиры:
- dark bg `#0E1117`
- dark surface `#171B24`
- dark text `#F3F4F6`
- dark muted `#9AA3B2`
- dark border `#2A3040`
- dark brand text `#FF8A3D`

## 16. SMM / Advertising

Все материалы строятся из того же brand core:
- логотип;
- один brand primary;
- Ink;
- единая типографика;
- одна геометрическая система;
- одинаковый CTA-язык.

Шаблоны: post, story, reels/tiktok cover, Telegram, banner, QR-poster, partner card.

## 17. Tone of voice

Понятный, профессиональный, короткий, спокойный, человеческий. Без канцелярита и без гипербол.

RU / KK / EN — равноправные локализации, не «перевод после дизайна».

## 18. Do / Don't

### Do

- использовать Git tokens;
- сохранять исходный логотип;
- связывать статус с текстом;
- использовать semantic tokens вместо локальных HEX;
- проверять mobile + desktop;
- сохранять иерархию и плотность.

### Don't

- создавать новый CSS-файл только ради переопределения старого;
- добавлять локальные `!important` как постоянное решение;
- делать отдельную дизайн-систему для каждой роли;
- использовать случайные радиусы, тени и icon packs;
- превращать glassmorphism в базовый визуальный язык;
- напрямую привязывать компоненты к произвольным HEX.

## 19. Ownership

Цепочка решений:

Brand core  
→ shared design contract  
→ semantic role tokens  
→ component API  
→ route/surface bridge  
→ Web/PWA/Android/iOS/SMM

Нижний слой не должен без причины переопределять верхний.

## 20. Next implementation steps

1. Сверить все brand colors с текущими runtime accents и выбрать единый semantic mapping без визуального скачка.
2. Перевести конфликтующие role-specific geometry aliases на shared contract либо явно задокументировать исключения.
3. Добавить brandbook preview и contract test, который проверяет логотип, ключевые tokens и отсутствие расхождения source-of-truth.
