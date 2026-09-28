# KARETA.KZ Master Home desktop evidence — 188.5.5.6.84.115

Source route: `http://localhost/#/master`.

Purpose: verify the desktop adaptation of the existing Master workplace without changing its business APIs or the approved seven-block mobile order.

Desktop result: 7/7 PASS at 1024×768, 1280×720, 1366×768, 1440×900, 1600×900, 1920×1080 and 2560×1440. Browser events: 0. Document horizontal overflow: 0.

Desktop composition:
- fixed DOM order remains header → status → quick-actions → my-requests → notes → paused → today;
- CSS places My Requests in the left 8/12 work area and Status / Today / Notes in the right 4/12 information area;
- measured work-area share is about 67%;
- quick actions are My Requests / Notes / Services / Parts;
- quick actions use 2 columns at 1024–1279 and 4 columns from 1280;
- rail is 84 px at 1024 and sidebar is 248 px from 1280;
- paused requests use the full row below the primary workspace.

Fixture boundary: the browser uses a synthetic local Master identity with capabilities profile.master, profile.read, work_orders.read and services.manageOwn; Master onboarding GET returns completed; Master workplace GET uses synthetic orders; background pull/realtime GETs are empty fixtures. No real account, phone number or POST mutation is used.

Reproducible runner: `tools/responsive/master_home_desktop_84_115.js`.
