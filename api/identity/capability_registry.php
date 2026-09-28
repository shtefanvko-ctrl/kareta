<?php
declare(strict_types=1);

final class KaretaCapabilityRegistry
{
    private const ALIASES = [
        'vehicle.read' => 'vehicles.read',
        'vehicle.edit' => 'vehicles.update',
        'orders.create' => 'requests.create',
        'order.create' => 'requests.create',
        'orders.readOwn' => 'requests.read',
        'orders.read' => 'requests.read',
        'order.read' => 'requests.read',
        'orders.take' => 'work_orders.take',
        'orders.updateAssigned' => 'work_orders.update',
        'orders.manageService' => 'work_orders.manage',
        'workorder.read' => 'work_orders.read',
        'work_order.read' => 'work_orders.read',
        'workorder.edit' => 'work_orders.update',
        'work_order.edit' => 'work_orders.update',
        'work_order.status.update' => 'work_orders.update_status',
        'workorder.assign' => 'work_orders.assign',
        'work_order.assign' => 'work_orders.assign',
        'chats.use' => 'chats.use',
        'chat.use' => 'chats.use',
        'calendar.manageOwn' => 'calendar.manage',
        'calendar.manageOrganization' => 'calendar.manage',
        'finance.manageOwn' => 'finance.manage',
        'finance.manageOrganization' => 'finance.manage',
        'notifications.manageOwn' => 'notifications.manage',
        'crm.note.write' => 'crm.notes.create',
        'market.manage' => 'market.products.manage',
        'market.product.manage_own' => 'market.products.manage',
        'market.order.read_own' => 'market.orders.read',
        'market.order.fulfill_own' => 'market.orders.fulfill',
        'seller.products.manage' => 'market.products.manage',
        'seller.stock.manage' => 'warehouse.stock.manage',
        'seller.orders.manage' => 'market.orders.manage',
        'warehouse.manage' => 'warehouse.stock.manage',
        'warehouse.reserve' => 'warehouse.stock.reserve',
        'services.manageOwn' => 'services.manage',
        'service.manage' => 'services.manage',
        'profile.manage_own' => 'profile.manage',
        'payment.intent.create' => 'payments.intent.create',
    ];

    public static function canonical(string $key): string
    {
        $key = trim($key);
        if ($key === '' || $key === '*') return $key;
        if (str_ends_with($key, '.*')) {
            $prefix = substr($key, 0, -2);
            $mapped = self::ALIASES[$prefix . '.read'] ?? null;
            if (is_string($mapped) && str_contains($mapped, '.')) {
                return substr($mapped, 0, (int)strrpos($mapped, '.')) . '.*';
            }
            return $key;
        }
        return self::ALIASES[$key] ?? $key;
    }

    public static function aliases(): array
    {
        return self::ALIASES;
    }

    public static function normalizeList(array $keys): array
    {
        $result = [];
        foreach ($keys as $key) {
            $canonical = self::canonical((string)$key);
            if ($canonical !== '') $result[$canonical] = true;
        }
        $normalized = array_keys($result);
        sort($normalized, SORT_STRING);
        return $normalized;
    }
}
