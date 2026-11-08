<?php
declare(strict_types=1);
/** Explicit hostname contract for role-specific SPA entrypoints. No authentication claims. */
function kareta_domain_surfaces(): array
{
    return [
        'client.kareta.kz' => ['surface'=>'client','role'=>'client','route'=>'home','label'=>'Кабинет клиента'],
        'work.kareta.kz'   => ['surface'=>'specialist','role'=>'master','route'=>'masterDashboard','label'=>'Кабинет мастера'],
        'works.kareta.kz'  => ['surface'=>'sto','role'=>'sto','route'=>'stoDashboard','label'=>'Управление СТО'],
        'shop.kareta.kz'   => ['surface'=>'shop','role'=>'seller','route'=>'seller','label'=>'Кабинет магазина'],
    ];
}
function kareta_domain_surface_for_host(string $host): ?array
{
    // A raw HTTP Host header is untrusted. Accept only a literal registered hostname
    // optionally followed by its numeric port; reject any other characters.
    $host = strtolower(trim($host));
    if (!preg_match('/^[a-z0-9.-]+(?::[0-9]{1,5})?$/D', $host)) return null;
    $name = explode(':', $host, 2)[0];
    $definition = kareta_domain_surfaces()[$name] ?? null;
    return $definition === null ? null : ['host'=>$name]+$definition;
}
