# FrigoPlan v6 — sincronización + notificaciones push

Esta versión parte de la versión colaborativa que ya funcionaba. **No incluye `config.js` a propósito**: conserva el `config.js` que ya tienes, con tu Project URL y Publishable Key.

## 1. Parte que ya funciona

- Sincronización de stock, compras, recetas y planificación mediante Supabase.
- Avisos dentro de FrigoPlan cuando otro dispositivo conectado cambia datos.
- Actualización automática de la PWA.

## 2. Notificaciones aunque FrigoPlan esté cerrada

Esta versión añade Web Push. Hay una configuración única adicional en Supabase, pero **no hay que modificar `config.js`**.

### Paso A — ejecutar SQL

En Supabase → SQL Editor, ejecuta el archivo `supabase_setup.sql` incluido en este ZIP.

Es seguro ejecutarlo sobre la instalación anterior: usa `create table if not exists`, políticas reemplazables y una comprobación para no añadir dos veces la tabla a Realtime.

### Paso B — desplegar la Edge Function

La carpeta `supabase/functions/frigoplan-push/` contiene la función que envía las notificaciones.

Necesitas desplegarla en tu proyecto Supabase con la Supabase CLI:

```bash
supabase login
supabase link --project-ref ukafnflwcjxzyfqikjzt
supabase functions deploy frigoplan-push --no-verify-jwt
```

### Paso C — guardar los secretos de la función

La clave pública VAPID ya está incorporada en `app.js`. La clave privada **no está en el ZIP ni en GitHub**.

Usa estas variables como secretos de Supabase:

- `VAPID_PUBLIC_KEY` = `BJmMd5BZCmFjgJxJjLVse7eElU9s3ag0WlEgRgrOQDxol-HiprqtUW3Sxvwq4tmYZKp53HfqLRh54bbQp278NJg`
- `VAPID_PRIVATE_KEY` = `2a97V_FXQzKYFJCA9hrjN9CiTCEtP5zJvhSaLQze_Kc`
- `VAPID_SUBJECT` = un correo tuyo, por ejemplo `mailto:tu-correo@example.com`

La función utiliza también los secretos internos de Supabase `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. No los copies a la aplicación ni a GitHub.

Puedes configurar los tres secretos VAPID con:

```bash
supabase secrets set VAPID_PUBLIC_KEY="BJmMd5BZCmFjgJxJjLVse7eElU9s3ag0WlEgRgrOQDxol-HiprqtUW3Sxvwq4tmYZKp53HfqLRh54bbQp278NJg" VAPID_PRIVATE_KEY="2a97V_FXQzKYFJCA9hrjN9CiTCEtP5zJvhSaLQze_Kc" VAPID_SUBJECT="mailto:tu-correo@example.com"
```

### Paso D — crear el webhook de base de datos

En Supabase → Database → Webhooks, crea un webhook para la tabla `public.frigoplan_rooms`:

- Eventos: `INSERT` y `UPDATE`.
- Método: `POST`.
- URL:
  `https://ukafnflwcjxzyfqikjzt.supabase.co/functions/v1/frigoplan-push`

Si el panel permite añadir headers, no hace falta enviar la service-role key: la función está desplegada con `verify_jwt = false` y usa su propio secreto interno para acceder a la tabla.

## 3. Activar el aviso en cada móvil/PC

1. Sube esta versión a GitHub Pages.
2. Actualiza FrigoPlan en cada dispositivo.
3. Entra en `👥 Colaborar` y conecta a la misma sala.
4. Pulsa `🔔 Activar avisos aunque la app esté cerrada`.
5. Acepta el permiso de notificaciones.

A partir de ahí, un cambio realizado desde otro dispositivo de la misma sala puede llegar como notificación del sistema aunque FrigoPlan no esté abierta.

### Compatibilidad

- Android/Chrome: compatible.
- Windows/Edge/Chrome: compatible.
- iPhone/iPad: para Web Push, añade FrigoPlan a la pantalla de inicio como PWA y concede permiso de notificaciones. Requiere una versión de iOS/iPadOS compatible con Web Push.

## Seguridad

`config.js` sigue siendo el único archivo local con la Publishable Key que ya utilizabas. La **VAPID privada y la service-role key no deben estar nunca en la PWA ni en GitHub**.

La sala sigue usando el código como llave de acceso, igual que en la versión anterior.
