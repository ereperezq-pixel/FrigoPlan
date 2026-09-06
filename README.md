# FrigoPlan v7

FrigoPlan es una PWA colaborativa para compartir stock, compras, recetas y planificación mediante Supabase.

## Configuración

Edita `config.js` y conserva tu configuración de Supabase. En navegador debe utilizarse la **Publishable Key**, nunca una Secret Key.

## Supabase

La tabla `public.frigoplan_rooms` usada por las versiones anteriores sigue siendo compatible. No es necesario cambiar la base de datos para esta versión.

## Colaboración y avisos

1. Abre FrigoPlan en cada dispositivo.
2. Entra en **Colaborar**.
3. Usa el mismo código de sala.
4. Pon un nombre distinto a cada dispositivo, por ejemplo `PC`, `Móvil` o `Tablet`.
5. Deja activado **Avisarme cuando otro dispositivo cambie stock o compras**.

La sincronización de datos continúa usando la tabla `frigoplan_rooms`. Los avisos inmediatos utilizan además **Supabase Realtime Broadcast**, de forma independiente de la actualización de la tabla.

Si el Broadcast no estuviera disponible temporalmente, la sincronización de datos por Postgres Changes sigue funcionando como respaldo.

## Actualizaciones

La PWA incluye detección de nuevas versiones mediante el service worker. Al publicar una nueva versión, la aplicación puede mostrar un aviso para actualizar.

## Notificaciones del sistema

Si el navegador permite la API `Notification` y el usuario concede permiso, FrigoPlan también puede mostrar una notificación del sistema mientras la aplicación está activa. Los avisos dentro de la propia aplicación no requieren permiso.
