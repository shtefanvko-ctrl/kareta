<?php
declare(strict_types=1);

/**
 * Единственный реестр статических ресурсов KARETA.KZ.
 * Порядок элементов важен: CSS и JS подключаются в указанной последовательности.
 */
function kareta_asset_registry(): array
{
    return [
        'styles' => [
            'css/runtime_boot_bundle.css',
            // Role-scoped shell authority. Eager by design so direct Master deep-links
            // never depend on which route happened to load first.
            'css/next/master_shell_canonical_84_143.css',
            // One owner for desktop route-root width/gutters across all roles.
            'css/next/page_geometry_canonical_84_146.css',
        ],
        'scripts' => [
            'js/next/runtime_logger.js',
            'js/next/runtime_dependencies.js',
            'js/next/recovery_manager.js',
            'js/next/diagnostics_snapshot.js',
            'js/next/app_preloader.js',
            'js/boot/runtime_onboarding_bundle.js',
            'js/boot/runtime_identity_bundle.js',
            'js/boot/runtime_shell_bundle.js',
            'js/boot/runtime_ui_bundle.js',
            'js/boot/runtime_core_bundle.js',
            'js/next/app_next.js',
        ],
        'images' => [
            'media/kareta_create_request_vehicle_background_r188_5_5_6_84_31.png',
            'assets/onboarding/kareta_logo_full.png',
            'assets/onboarding/kareta_logo_icon.png',
            'assets/onboarding/backgrounds/welcome/city-calm/city-calm-mobile.png',
            'assets/onboarding/backgrounds/welcome/city-calm/city-calm-desktop-narrow.png',
            'assets/onboarding/backgrounds/welcome/city-calm/city-calm-desktop-standard.png',
            'assets/onboarding/backgrounds/welcome/city-calm/city-calm-desktop-ultrawide.png',
            'assets/onboarding/backgrounds/welcome/road-assist/road-assist-mobile.png',
            'assets/onboarding/backgrounds/welcome/road-assist/road-assist-desktop-narrow.png',
            'assets/onboarding/backgrounds/welcome/road-assist/road-assist-desktop-standard.png',
            'assets/onboarding/backgrounds/welcome/road-assist/road-assist-desktop-ultrawide.png',
            'assets/onboarding/backgrounds/welcome/service-map/service-map-mobile.png',
            'assets/onboarding/backgrounds/welcome/service-map/service-map-desktop-narrow.png',
            'assets/onboarding/backgrounds/welcome/service-map/service-map-desktop-standard.png',
            'assets/onboarding/backgrounds/welcome/service-map/service-map-desktop-ultrawide.png',
            'assets/errors/403/backgrounds/closed-entrance.png',
            'assets/errors/403/backgrounds/blocked-route.png',
            'assets/errors/403/backgrounds/protected-vehicle.png',
            'assets/errors/403/backgrounds/protected-digital-space.png',
            'assets/errors/403/backgrounds/access-pass-denied.png',
            'assets/errors/403/backgrounds/closed-service-bay.png',
            'assets/errors/403/backgrounds/protected-map-zone.png',
            'assets/errors/403/backgrounds/service-shield.png',
        ],
        'critical' => [
            'js/next/runtime_logger.js',
            'js/next/runtime_dependencies.js',
            'css/next/app_preloader.css',
            'css/next/app_next.css',
            'css/next_shell.css',
            'js/next/app_preloader.js',
            'js/next/api_client.js',
            'js/next/core/realtime_client.js',
            'js/next/social_state.js',
            'js/next/runtime_integrity.js',
            'js/next/route_registry.js',
            'js/next/route_lifecycle.js',
            'js/next/route_runtime.js',
            'js/next/route_asset_loader.js',
            'js/next/session_resume_runtime.js',
            'js/next/app_next.js',
            'assets/onboarding/kareta_logo_full.png',
            'assets/onboarding/kareta_logo_icon.png',
        ],
        // R188.5.5.6.84.82: canonical source modules retained for audit/build integrity.
        // Browser boot uses the generated bundles in 'scripts' above.
        'scriptSources' => [
            'js/next/runtime_logger.js',
            'js/next/runtime_dependencies.js',
            'js/next/recovery_manager.js',
            'js/next/diagnostics_snapshot.js',
            'js/next/app_preloader.js',
            'js/next/welcome_background.js',
            'js/next/error_403_background.js',
            'js/next/onboarding/onboarding_state.js',
            'js/next/onboarding/onboarding_profile_draft.js',
            'js/next/onboarding/onboarding_router.js',
            'js/next/onboarding/onboarding_navigation.js',
            'js/next/onboarding/onboarding_api.js',
            'js/next/onboarding/post_auth_first_entry_resolver.js',
            'js/next/onboarding/onboarding_app.js',
            'js/next/onboarding/onboarding_phone_runtime.js',
            'js/next/onboarding/onboarding_form_ui.js',
            'js/next/onboarding/onboarding_form_validation.js',
            'js/next/kflow_windows.js',
            'js/next/onboarding/pages/role_definitions.js',
            'js/next/onboarding/onboarding_selection_catalog.js',
            'js/next/onboarding/pages/role_page.js',
            'js/next/onboarding/pages/client_profile_page.js',
            'js/next/onboarding/pages/master_profile_page.js',
            'js/next/onboarding/pages/service_profile_page.js',
            'js/next/onboarding/pages/seller_profile_page.js',
            'js/next/onboarding/pages/profile_registry.js',
            'js/next/onboarding/onboarding_lifecycle.js',
            'js/next/onboarding_bridge.js',
            'js/next/route_registry.js',
            'js/next/production_guard.js',
            'js/next/identity_frontend.js',
            'js/next/master_onboarding_gate.js',
            'js/next/dynamic_navigation.js',
            'js/next/role_access.js',
            'js/next/context_manager.js',
            'js/next/ui_icons.js',
            'js/next/reference_client_shell.js',
            'js/next/navigation_core.js',
            'js/next/shell_nav.js',
            'js/next/shell_menu.js',
            'js/next/route_lifecycle.js',
            'js/next/route_runtime.js',
            'js/next/route_asset_loader.js',
            'js/next/dashboard_engine.js',
            'js/next/dashboard_widgets.js',
            'js/next/smart_action_hub.js',
            'js/next/navigation_state.js',
            'js/next/mobile_back.js',
            'js/next/mobile_filters.js',
            'js/next/session_resume_runtime.js',
            'js/next/page_ui.js',
            'js/next/catalog_cards.js',
            'js/next/social_cards.js',
            'js/next/workflow_engine.js',
            'js/next/core/ui_kit.js',
            'js/next/api_client.js',
            'js/next/core/realtime_client.js',
            'js/next/social_state.js',
            'js/next/runtime_integrity.js',
            'js/next/toast.js',
            'js/next/native_dialogs.js',
            'js/next/swiper_loader.js',
            'js/next/slider_runtime.js',
            'js/next/pages/core.js',
            'js/next/request_window.js',
            'js/next/client/client_cabinet_api.js',
            'js/next/client/first_vehicle_flow.js',
            'js/next/account_window.js',
            'js/next/window_engine.js',
            'js/next/client_viewport_runtime.js',
            'js/next/client_surface_modernization_phase3.js',
            'js/next/app_next.js',
        ],
    ];
}


/**
 * R188.5.5.6.84.72 route asset plan.
 * Heavy route modules are no longer part of the atomic eager runtime.
 * They are loaded on first navigation through KaretaRouteAssetLoader.
 */
function kareta_route_asset_plan(): array
{
    return [
        '_meta' => [
            'mode' => 'route-lazy-v5',
            'bootJsMode' => 'grouped-source-bundles-v1',
            'bootProfiler' => 'timeline-v1',
            'release' => defined('KARETA_ASSET_VERSION') ? (string)KARETA_ASSET_VERSION : 'dev',
            'cssMode' => 'critical-boot-route-css-v2',
        ],
        '_sourceLayers' => [
            'css/next/app_preloader.css',
            'css/next/app_next.css',
            'css/next/context_switcher.css',
            'css/next_shell.css',
            'css/next/masters.css',
            'css/next/community.css',
            'css/next/details.css',
            'css/next/request.css',
            'css/next/work_order.css',
            'css/next/sto_workplace.css',
            'css/next/home_simple.css',
            'css/next/catalog_cards.css',
            'css/next/social_cards.css',
            'css/next/profile_relations.css',
            'css/next/workflow.css',
            'css/next/identity_migration.css',
            'css/next/realtime.css',
            'css/next/unified_hero.css',
            'css/next/mobile_back.css',
            'css/next/mobile_filters.css',
            'css/next/toast.css',
            'css/onboarding_bundle.css',
            'css/next/onboarding_registration.css',
            'css/next/narrow_mobile.css',
            'css/next/icon_standard.css',
            'css/next/smart_action_hub.css',
            'css/next/workspace_admin.css',
            'css/next/role_workspaces.css',
            'css/next/dashboard_engine.css',
            'css/next/social_fullscreen_pages.css',
            'css/next/navigation_more_accessibility.css',
            'css/next/context_switcher_more_layouts.css',
            'css/next/client_mobile_navigation.css',
            'css/next/legacy_role_picker_cleanup.css',
            'css/next/role_surfaces_chat_spacing.css',
            'css/next/role_runtime_chats.css',
            'css/next/mobile_services_context_grid.css',
            'css/next/account_type_catalog.css',
            'css/next/master_surfaces.css',
            'css/next/master_business_runtime.css',
            'css/next/master_order_lifecycle.css',
            'css/next/master_aftercare.css',
            'css/next/operational_finance.css',
            'css/next/client_exchange_scale.css',
            'css/next/master_mobile_nav.css',
            'css/next/shell_session_stability.css',
            'css/next/desktop_full_width.css',
            'css/next/community_group_slide_width.css',
            'css/next/community_feed_desktop_grid.css',
            'css/next/desktop_card_grid_expansion.css',
            'css/next/client_account_native.css',
            'css/next/master_service_pricing_native.css',
            'css/next/shell_burger_recovery.css',
            'css/next/parts_native_marketplace.css',
            'css/next/parts_windows_product_detail.css',
            'css/next/used_market_listing_wizard.css',
            'css/next/used_market_owner_management.css',
            'css/next/seller_native_workplace.css',
            'css/next/seller_profile_storefront_native.css',
            'css/next/master_exchange_acceptance_flow.css',
            'css/next/account_tariffs_master_capacity.css',
            'css/next/tariff_admin_kareta_pro.css',
            'css/next/master_ui_exchange_schedule_flattening.css',
            'css/next/sto_recovery_native_operations.css',
            'css/next/sto_schedule_capacity_command_center.css',
            'css/next/sto_native_surface_audit.css',
            'css/next/window_engine.css',
            'css/next/work_order_windows.css',
            'css/next/client_request_garage.css',
            'css/next/first_vehicle_flow.css',
            'css/next/client_account_windows.css',
            'css/next/social_windows.css',
            'css/next/sto_workspace_windows.css',
            'css/next/seller_workspace_windows.css',
            'css/next/ux_cleanup.css',
            'css/next/kflow_windows.css',
            'css/next/welcome_background.css',
            'css/next/onboarding_kflow_reference.css',
            'css/next/error_403_background.css',
            'css/next/kflow_primary_pages.css',
            'css/next/client_surface_layout.css',
            'css/next/reference_client_pages.css',
            'css/next/client_runtime_consolidated.css',
            'css/next/mobile_brand_center.css',
            'css/next/client_width_guard.css',
            'css/next/client_mobile_geometry.css',
            'css/next/client_viewport_layers.css',
            'css/next/request_5_steps.css',
            'css/next/client_legacy_surface_modernization.css',
            'css/next/client_surface_modernization_phase2.css',
            'css/next/client_surface_modernization_phase3.css',
            'css/next/client_work_order_v2.css',
        ],
        '_lazyStyleLayers' => [
            'css/next/request_5_steps.css',
            'css/next/client_work_order_v2.css',
            'css/next/client_legacy_surface_modernization.css',
            'css/next/client_surface_modernization_phase2.css',
        ],
        // R188.5.5.6.84.81 — route-only CSS extracted from the critical boot bundle.
        // These style-only bundles execute before the pre-existing route-lazy override files below.
        'cssCommunityBase' => [
            'lazy' => true, 'routeKeys' => ['community'], 'routes' => ['#/community'],
            'styles' => ['css/routes/community_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssProvidersBase' => [
            'lazy' => true, 'routeKeys' => ['masters','providerDetail','providerBooking','providerReviews'],
            'routes' => ['#/masters','#/masters/profile/*','#/masters/book/*','#/masters/reviews/*'],
            'styles' => ['css/routes/providers_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssDetailsBase' => [
            'lazy' => true, 'routeKeys' => ['productDetail','serviceDetail','providerDetail','providerBooking'],
            'routes' => ['#/parts/item/*','#/services/item/*','#/masters/profile/*','#/masters/book/*'],
            'styles' => ['css/routes/details_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssWorkOrderBase' => [
            'lazy' => true, 'routeKeys' => ['workOrder'], 'routes' => ['#/orders/item/*'],
            'styles' => ['css/routes/work_order_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssStoBase' => [
            'lazy' => true, 'routeKeys' => ['stoDashboard'], 'routes' => ['#/sto'],
            'styles' => ['css/routes/sto_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssProfileBase' => [
            'lazy' => true, 'routeKeys' => ['profile'], 'routes' => ['#/profile','#/profile/person/*','#/profile/organization/*'],
            'styles' => ['css/routes/profile_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssWorkflowBase' => [
            'lazy' => true, 'routeKeys' => ['workflow'], 'routes' => ['#/workflow'],
            'styles' => ['css/routes/workflow_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssServicesBase' => [
            'lazy' => true, 'routeKeys' => ['services'], 'routes' => ['#/services','#/services/group/*','#/services/category/*'],
            'styles' => ['css/routes/services_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssMasterBase' => [
            'lazy' => true,
            'routeKeys' => ['masterOnboarding','masterDashboard','masterSchedule','masterProfileOwner','masterWallOwner','masterWorks','masterReviews','masterExchange','serviceManagement'],
            'routes' => ['#/onboarding/master','#/master','#/master/schedule','#/master/profile','#/master/wall','#/master/works','#/master/reviews','#/master/exchange','#/services/manage'],
            'styles' => ['css/routes/master_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssFinanceBase' => [
            'lazy' => true, 'routeKeys' => ['finance'], 'routes' => ['#/finance'],
            'styles' => ['css/routes/finance_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        // Details historically preceded Parts in the eager cascade, so Parts stays after Details here.
        'cssPartsBase' => [
            'lazy' => true, 'routeKeys' => ['parts','usedParts','productDetail'],
            'routes' => ['#/parts','#/parts/used','#/parts/item/*'],
            'styles' => ['css/routes/parts_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssSellerBase' => [
            'lazy' => true, 'routeKeys' => ['seller','sellerProducts','sellerOrders'],
            'routes' => ['#/seller','#/seller/products','#/seller/orders'],
            'styles' => ['css/routes/seller_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        'cssCabinetBase' => [
            'lazy' => true,
            'routeKeys' => ['cabinet','cabinetGarage','cabinetData','cabinetHistory','cabinetDocuments','cabinetPromos','cabinetTariff','cabinetSettings'],
            'routes' => ['#/cabinet','#/cabinet/garage','#/cabinet/data','#/cabinet/history','#/cabinet/documents','#/cabinet/promotions','#/cabinet/tariff','#/cabinet/settings'],
            'styles' => ['css/routes/cabinet_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        // Social window rules followed Community/Parts/Master layers in the old eager bundle.
        'cssSocialWindowsBase' => [
            'lazy' => true, 'routeKeys' => ['community','chats','works','realWorks','workDetail'],
            'routes' => ['#/community','#/chats','#/works','#/real-works','#/works/item/*'],
            'styles' => ['css/routes/social_windows_runtime.css'], 'scripts' => [], 'globals' => [],
        ],
        // Re-apply historical late client geometry before the old route-specific override files.
        'cssClientGuardPostlude' => [
            'lazy' => true,
            'routeKeys' => ['community','parts','usedParts','productDetail','masters','providerDetail','providerBooking','providerReviews','serviceDetail','services','profile','following','requestNew','workOrder','cabinet','cabinetGarage','cabinetData','cabinetHistory','cabinetDocuments','cabinetPromos','cabinetTariff','cabinetSettings','chats','notifications','works','realWorks','workDetail','vehicle','orders','workflow','about','rules','help','privacy','contacts','lawyer','towTruck'],
            'routes' => ['#/*'],
            'styles' => ['css/routes/client_guard_postlude.css'], 'scripts' => [], 'globals' => [],
        ],

        'community' => [
            'lazy' => true,
            'routeKeys' => ['community'],
            'routes' => ['#/community'],
            'styles' => [],
            'scripts' => [
                'js/next/community/community_state.js',
                'js/next/community/community_api.js',
                'js/next/pages/community.js',
            ],
            'globals' => ['KaretaCommunityState','KaretaCommunityApi','KaretaCommunityPages'],
        ],
        'parts' => [
            'lazy' => true,
            'routeKeys' => ['parts','usedParts','productDetail'],
            'routes' => ['#/parts','#/parts/used','#/parts/item/*'],
            'styles' => [],
            'scripts' => [
                'js/next/shop/shop_api.js',
                'js/next/shop/shop_state.js',
                'js/next/pages/parts.js',
            ],
            'globals' => ['KaretaShopApi','KaretaShopState','KaretaPartsPages'],
        ],
        'masters' => [
            'lazy' => true,
            'routeKeys' => ['masters'],
            'routes' => ['#/masters'],
            'styles' => [],
            'scripts' => ['js/next/pages/masters.js'],
            'globals' => ['KaretaMastersPages'],
        ],
        'details' => [
            'lazy' => true,
            'routeKeys' => ['productDetail','serviceDetail','providerDetail','providerBooking'],
            'routes' => ['#/parts/item/*','#/services/item/*','#/masters/profile/*','#/masters/book/*'],
            'styles' => [],
            'scripts' => ['js/next/pages/details.js'],
            'globals' => ['KaretaDetailPages'],
        ],
        'sto' => [
            'lazy' => true,
            'routeKeys' => ['stoDashboard'],
            'routes' => ['#/sto'],
            'styles' => [],
            'scripts' => [
                'js/next/work_orders/sto_workplace_api.js',
                'js/next/pages/sto_workplace.js',
            ],
            'globals' => ['KaretaStoWorkplaceApi','KaretaStoWorkplacePages'],
        ],
        'seller' => [
            'lazy' => true,
            'routeKeys' => ['seller','sellerProducts','sellerOrders'],
            'routes' => ['#/seller','#/seller/products','#/seller/orders'],
            'styles' => [],
            'scripts' => [
                'js/next/seller/seller_api.js',
                'js/next/seller/seller_state.js',
                'js/next/pages/seller.js',
            ],
            'globals' => ['KaretaSellerApi','KaretaSellerState','KaretaSellerPages'],
        ],
        'admin' => [
            'lazy' => true,
            'routeKeys' => ['identityMigration','adminUsers','adminOrganizations','adminMonitoring','adminManagement'],
            'routes' => ['#/admin/identity-migration','#/admin/users','#/admin/organizations','#/admin/monitoring','#/admin/management'],
            'styles' => [],
            'scripts' => [
                'js/next/pages/identity_migration.js',
                'js/next/pages/admin_workspaces.js',
            ],
            'globals' => ['KaretaIdentityMigrationPages','KaretaAdminWorkspacePages'],
        ],

        // R188.5.5.6.84.67 extraction wave: public services and master service management.
        'servicesCatalog' => [
            'lazy' => true,
            'routeKeys' => ['services'],
            'routes' => ['#/services','#/services/group/*','#/services/category/*'],
            'styles' => [],
            'scripts' => [
                'js/next/catalog/catalog_api.js',
                'js/next/catalog/catalog_state.js',
                'js/next/pages/services.js',
            ],
            'globals' => ['KaretaCatalogApi','KaretaCatalogState','KaretaServicesPages'],
        ],
        'serviceOffers' => [
            'lazy' => true,
            'routeKeys' => ['requestNew','serviceManagement'],
            'routes' => ['#/orders/new','#/services/manage'],
            'styles' => [],
            'scripts' => [
                'js/next/services/service_offers_api.js',
                'js/next/services/service_offers_state.js',
            ],
            'globals' => ['KaretaServiceOffersApi','KaretaServiceOffersState'],
        ],
        'serviceManagement' => [
            'lazy' => true,
            'routeKeys' => ['serviceManagement'],
            'routes' => ['#/services/manage'],
            'styles' => ['css/next/master_requests_workplace_services.css'],
            'scripts' => ['js/next/services/master_setup_picker.js','js/next/pages/service_management.js'],
            'globals' => ['KaretaMasterSetupPicker','KaretaServiceManagementPages'],
        ],
        'profile' => [
            'lazy' => true,
            'routeKeys' => ['profile'],
            'routes' => ['#/profile','#/profile/person/*','#/profile/organization/*'],
            'styles' => [],
            'scripts' => ['js/next/pages/profile_relations.js'],
            'globals' => ['KaretaProfileRelationsPages'],
        ],
        'following' => [
            'lazy' => true,
            'routeKeys' => ['following'],
            'routes' => ['#/following'],
            'styles' => [],
            'scripts' => ['js/next/pages/following.js'],
            'globals' => ['KaretaFollowingPages'],
        ],
        'request' => [
            'lazy' => true,
            'routeKeys' => ['requestNew'],
            'routes' => ['#/orders/new'],
            // These two late override files were formerly inside client_runtime_consolidated.css.
            // Loading them after the global client guard preserves their effective cascade.
            'styles' => ['css/next/request_5_steps.css'],
            'scripts' => ['js/next/pages/request.js'],
            'globals' => ['KaretaRequestPages'],
        ],
        'workOrder' => [
            'lazy' => true,
            'routeKeys' => ['workOrder'],
            'routes' => ['#/orders/item/*'],
            'styles' => ['css/next/client_work_order_v2.css'],
            'scripts' => [
                'js/next/work_orders/work_order_api.js',
                'js/next/pages/work_order.js',
            ],
            'globals' => ['KaretaWorkOrderApi','KaretaWorkOrderPages'],
        ],
        // R188.5.5.6.84.68 extraction wave: client workspaces, entity windows and professional master surfaces.
        'cabinet' => [
            'lazy' => true,
            'routeKeys' => ['cabinet','cabinetGarage','cabinetData','cabinetHistory','cabinetDocuments','cabinetPromos','cabinetTariff','cabinetSettings'],
            'routes' => ['#/cabinet','#/cabinet/garage','#/cabinet/data','#/cabinet/history','#/cabinet/documents','#/cabinet/promotions','#/cabinet/tariff','#/cabinet/settings'],
            'styles' => ['css/next/client_cabinet.css'],
            'scripts' => ['js/next/messaging_settings.js','js/next/catalog/json_catalog_loader.js','js/next/pages/cabinet.js'],
            'globals' => ['KaretaMessagingSettings','KaretaCabinetPages'],
        ],
        'chats' => [
            'lazy' => true,
            'routeKeys' => ['chats'],
            'routes' => ['#/chats'],
            'styles' => ['css/next/chats.css'],
            'scripts' => ['js/next/pages/chats.js'],
            'globals' => ['KaretaChatsPages'],
        ],
        'notifications' => [
            'lazy' => true,
            'routeKeys' => ['notifications'],
            'routes' => ['#/notifications'],
            'styles' => ['css/next/notifications.css'],
            'scripts' => ['js/next/pages/notifications.js'],
            'globals' => ['KaretaNotificationsPages'],
        ],
        'workFeed' => [
            'lazy' => true,
            'routeKeys' => ['works','masterExchange','realWorks','workDetail'],
            'routes' => ['#/works','#/master/exchange','#/real-works','#/works/item/*'],
            'styles' => ['css/next/work_feed.css'],
            'scripts' => ['js/next/pages/work_feed.js'],
            'globals' => ['KaretaWorkFeedPages'],
        ],
        'vehicle' => [
            'lazy' => true,
            'routeKeys' => ['vehicle'],
            'routes' => ['#/garage/car/*'],
            'styles' => ['css/next/vehicle.css'],
            'scripts' => [
                'js/next/vehicles/vehicle_api.js',
                'js/next/pages/vehicle.js',
            ],
            'globals' => ['KaretaVehicleApi','KaretaVehiclePages'],
        ],
        'ordersCore' => [
            'lazy' => true,
            'routeKeys' => ['orders','workflow'],
            'routes' => ['#/orders','#/workflow'],
            'styles' => [],
            'scripts' => [
                'js/next/orders/orders_api.js',
                'js/next/orders/orders_state.js',
            ],
            'globals' => ['KaretaOrdersApi','KaretaOrdersState'],
        ],
        'ordersPage' => [
            'lazy' => true,
            'routeKeys' => ['orders'],
            'routes' => ['#/orders'],
            'styles' => ['css/next/client_orders_native.css'],
            'scripts' => ['js/next/pages/orders.js'],
            'globals' => ['KaretaOrdersPages'],
        ],
        'workflowPage' => [
            'lazy' => true,
            'routeKeys' => ['workflow'],
            'routes' => ['#/workflow'],
            'styles' => [],
            'scripts' => ['js/next/pages/workflow.js'],
            'globals' => ['KaretaWorkflowPages'],
        ],
        'news' => [
            'lazy' => true,
            'routeKeys' => ['news','masterNews','masterNewsCreate','masterNewsEdit'],
            'routes' => ['#/news','#/master/news','#/master/news/create','#/master/news/edit/*'],
            'styles' => [],
            'scripts' => ['js/next/pages/news.js'],
            'globals' => ['KaretaNewsPages'],
        ],
        'infoPages' => [
            'lazy' => true,
            'routeKeys' => ['about','rules','help','privacy','contacts','lawyer','towTruck'],
            'routes' => ['#/about','#/rules','#/help','#/privacy','#/contacts','#/lawyer','#/tow-truck'],
            'styles' => [],
            'scripts' => ['js/next/pages/info.js'],
            'globals' => ['KaretaInfoPages'],
        ],
        'notFound' => [
            'lazy' => true,
            'routeKeys' => ['notFound'],
            'routes' => ['#/404'],
            'styles' => ['css/next/not_found_84_146.css'],
            'scripts' => ['js/next/pages/not_found.js'],
            'globals' => ['KaretaNotFoundPages'],
        ],
        'clientLegacyPhase1' => [
            'lazy' => true,
            'routeKeys' => ['notifications','serviceDetail','profile','following'],
            'routes' => ['#/notifications','#/services/item/*','#/profile','#/profile/person/*','#/profile/organization/*','#/following'],
            'styles' => ['css/next/client_legacy_surface_modernization.css'],
            'scripts' => [],
            'globals' => [],
        ],
        'clientPhase2' => [
            'lazy' => true,
            'routeKeys' => ['realWorks','workDetail','about','rules','help','privacy','contacts','lawyer','towTruck'],
            'routes' => ['#/real-works','#/works/item/*','#/about','#/rules','#/help','#/privacy','#/contacts','#/lawyer','#/tow-truck'],
            'styles' => ['css/next/client_surface_modernization_phase2.css'],
            'scripts' => [],
            'globals' => [],
        ],
        'masterOnboarding' => [
            'lazy' => true,
            'routeKeys' => ['masterOnboarding'],
            'routes' => ['#/onboarding/master'],
            'styles' => ['css/next/master_onboarding.css'],
            'scripts' => ['js/next/pages/master_onboarding.js'],
            'globals' => ['KaretaMasterOnboardingPages'],
        ],
        'masterWorkplaceApi' => [
            'lazy' => true,
            'routeKeys' => ['masterDashboard','cabinetSettings'],
            'routes' => ['#/master','#/cabinet/settings'],
            'styles' => ['css/next/master_requests_workplace_services.css'],
            'scripts' => ['js/next/work_orders/master_workplace_api.js'],
            'globals' => ['KaretaMasterWorkplaceApi'],
        ],
        'masterWorkspace' => [
            'lazy' => true,
            'routeKeys' => ['masterDashboard','masterSchedule'],
            'routes' => ['#/master','#/master/schedule'],
            'styles' => [
                'css/next/master_schedule.css',
                'css/next/master_workplace_native.css',
                'css/next/master_order_communication_scheduling.css',
                'css/next/master_capacity_reschedule.css',
                'css/next/master_shift_breaks_arrival.css',
                'css/next/master_day_operations_auto_recovery.css',
                'css/next/master_auto_recovery_control_center.css',
                'css/next/master_workspace_windows.css',
            ],
            'scripts' => [
                'js/next/work_orders/master_schedule_api.js',
                'js/next/pages/master_workplace.js',
                'js/next/pages/master_schedule.js',
            ],
            'globals' => ['KaretaMasterScheduleApi','KaretaMasterWorkplacePages','KaretaMasterSchedulePages'],
        ],
        'masterProfileOwner' => [
            'lazy' => true,
            'routeKeys' => ['masterProfileOwner'],
            'routes' => ['#/master/profile'],
            'styles' => ['css/next/master_owner_profile.css'],
            'scripts' => ['js/next/pages/master_profile_owner.js'],
            'globals' => ['KaretaMasterProfileOwnerPages'],
        ],
        'masterWall' => [
            'lazy' => true,
            'routeKeys' => ['masterWallOwner'],
            'routes' => ['#/master/wall'],
            'styles' => ['css/next/master_social_wall.css'],
            'scripts' => ['js/next/pages/master_wall.js'],
            'globals' => ['KaretaMasterWallPages'],
        ],
        'masterWorks' => [
            'lazy' => true,
            'routeKeys' => ['masterWorks'],
            'routes' => ['#/master/works'],
            'styles' => ['css/next/master_works_portfolio.css'],
            'scripts' => ['js/next/pages/master_works.js'],
            'globals' => ['KaretaMasterWorksPages'],
        ],
        'masterReviews' => [
            'lazy' => true,
            'routeKeys' => ['masterReviews','providerReviews'],
            'routes' => ['#/master/reviews','#/masters/reviews/*'],
            'styles' => ['css/next/master_reviews_social.css'],
            'scripts' => ['js/next/pages/master_reviews.js'],
            'globals' => ['KaretaMasterReviewsPages'],
        ],
        // R188.5.5.6.84.69 extraction wave: platform/business domains.
        'platformSuite' => [
            'lazy' => true,
            'routeKeys' => ['platform'],
            'routes' => ['#/platform'],
            'styles' => ['css/next/platform.css'],
            'scripts' => ['js/next/platform_search.js','js/next/pages/platform.js'],
            'globals' => ['KaretaPlatformSearch','KaretaPlatformPages'],
        ],
        'corePlatform' => [
            'lazy' => true,
            'routeKeys' => ['corePlatform'],
            'routes' => ['#/core'],
            'styles' => ['css/next/core_platform.css'],
            'scripts' => [
                'js/next/core/domain_model.js',
                'js/next/core/event_bus.js',
                'js/next/core/state_manager.js',
                'js/next/core/domain_repository.js',
                'js/next/pages/core_platform.js',
            ],
            'globals' => ['KaretaDomainModel','KaretaEventBus','KaretaStateManager','KaretaDomainRepository','KaretaCorePlatformPages'],
        ],
        'calendarBooking' => [
            'lazy' => true, 'routeKeys' => ['calendarBooking'], 'routes' => ['#/calendar'],
            'styles' => ['css/next/calendar_booking.css'], 'scripts' => ['js/next/pages/calendar_booking.js'],
            'globals' => ['KaretaCalendarBookingPages'],
        ],
        'financeDomain' => [
            'lazy' => true, 'routeKeys' => ['finance'], 'routes' => ['#/finance'],
            'styles' => ['css/next/finance.css'], 'scripts' => ['js/next/pages/finance.js'],
            'globals' => ['KaretaFinancePages'],
        ],
        'marketDomain' => [
            'lazy' => true, 'routeKeys' => ['market'], 'routes' => ['#/market'],
            'styles' => ['css/next/market.css'], 'scripts' => ['js/next/pages/market.js'],
            'globals' => ['KaretaMarketPages'],
        ],
        'crmDomain' => [
            'lazy' => true, 'routeKeys' => ['crm'], 'routes' => ['#/crm'],
            'styles' => ['css/next/crm.css'], 'scripts' => ['js/next/pages/crm.js'],
            'globals' => ['KaretaCrmPages'],
        ],
        'assistantDomain' => [
            'lazy' => true, 'routeKeys' => ['assistant'], 'routes' => ['#/assistant'],
            'styles' => [], 'scripts' => ['js/next/pages/assistant.js'],
            'globals' => ['KaretaAssistantPages'],
        ],
        'diagnosticsDomain' => [
            'lazy' => true, 'routeKeys' => ['diagnostics'], 'routes' => ['#/diagnostics'],
            'styles' => ['css/next/diagnostics.css'], 'scripts' => ['js/next/pages/diagnostics.js'],
            'globals' => ['KaretaDiagnosticsPages'],
        ],

        // R188.5.5.6.84.102 — canonical Master surface is always applied last.
        // The loader re-appends this stylesheet on each matching route so retained
        // route links cannot make the Master UI depend on navigation history.
        'masterSurfaceContract' => [
            'lazy' => true,
            'cascade' => 'last',
            'routeKeys' => ['masterDashboard','masterSchedule','masterExchange','serviceManagement','masterProfileOwner','masterWallOwner','masterWorks','masterReviews','cabinet','cabinetSettings','orders','chats','parts','community'],
            'routes' => ['#/master','#/master/schedule','#/master/exchange','#/services/manage','#/master/profile','#/master/wall','#/master/works','#/master/reviews','#/cabinet','#/cabinet/settings','#/orders','#/chats','#/parts','#/community'],
            'styles' => ['css/next/master_ui_foundation.css','css/next/master_role_skin.css','css/next/master_surface_contract.css','css/routes/master_reference_final_84_130.css','css/next/master_shell_canonical_84_143.css'],
            'scripts' => [],
            'globals' => [],
        ],
    ];
}

/** Return unique route-bundle assets for validation/hygiene tooling. */
function kareta_route_asset_paths(string $group = ''): array
{
    $out = [];
    foreach (kareta_route_asset_plan() as $key => $bundle) {
        if (!is_array($bundle) || str_starts_with((string)$key, '_') || empty($bundle['lazy'])) continue;
        $groups = $group !== '' ? [$group] : ['styles','scripts'];
        foreach ($groups as $candidate) {
            foreach (($bundle[$candidate] ?? []) as $path) {
                if (!is_string($path) || $path === '') continue;
                $out[$candidate . ':' . $path] = $path;
            }
        }
    }
    return array_values($out);
}

function kareta_asset_root(): string
{
    return dirname(__DIR__);
}

function kareta_asset_normalize(string $path): string
{
    $path = str_replace('\\', '/', trim($path));
    $path = ltrim($path, '/');
    if ($path === '' || str_contains($path, '..')) {
        throw new InvalidArgumentException('Некорректный путь ассета.');
    }
    return $path;
}

function kareta_asset_exists(string $path): bool
{
    $path = kareta_asset_normalize($path);
    return is_file(kareta_asset_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path));
}

function kareta_asset_missing(): array
{
    $registry = kareta_asset_registry();
    $paths = array_values(array_unique(array_merge(
        $registry['styles'],
        $registry['scripts'],
        $registry['scriptSources'] ?? [],
        $registry['images'],
        function_exists('kareta_route_asset_paths') ? kareta_route_asset_paths() : []
    )));
    return array_values(array_filter($paths, static fn(string $path): bool => !kareta_asset_exists($path)));
}

/**
 * Возвращает публичный URL ассета с версией релиза.
 */
function kareta_asset_cache_token(): string
{
    $version = defined('KARETA_ASSET_VERSION') ? trim((string) KARETA_ASSET_VERSION) : 'dev';
    if ($version !== '' && strlen($version) <= 32 && preg_match('/^[A-Za-z0-9._-]+$/', $version) === 1) {
        return $version;
    }
    return 'h' . substr(hash('sha256', $version), 0, 12);
}

function asset_ver(string $path): string
{
    $path = kareta_asset_normalize($path);
    return '/' . $path . '?v=' . rawurlencode(kareta_asset_cache_token());
}

/**
 * Безопасно формирует теги стилей из единого реестра.
 */
function kareta_render_styles(): string
{
    $registry = kareta_asset_registry();
    $tags = [];
    foreach ($registry['styles'] as $path) {
        if (!kareta_asset_exists($path)) {
            continue;
        }
        $url = htmlspecialchars(asset_ver($path), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $tags[] = '<link rel="stylesheet" href="' . $url . '">';
    }
    return implode("\n  ", $tags);
}

/**
 * Безопасно формирует теги сценариев из единого реестра.
 */
function kareta_render_scripts(): string
{
    $registry = kareta_asset_registry();
    $tags = [];
    $release = kareta_asset_cache_token();
    foreach ($registry['scripts'] as $order => $path) {
        if (!kareta_asset_exists($path)) {
            continue;
        }
        $url = htmlspecialchars(asset_ver($path), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $releaseAttribute = htmlspecialchars($release, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $tags[] = '<script src="' . $url . '" defer data-kareta-script-order="' . (int) $order . '" data-kareta-release="' . $releaseAttribute . '"></script>';
    }
    return implode("\n  ", $tags);
}
