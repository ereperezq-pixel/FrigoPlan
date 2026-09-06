# FrigoPlan colaborativo

La app sigue funcionando en local, pero añade sincronización en tiempo real entre dispositivos mediante Supabase.

## Configuración única
1. Crea un proyecto en Supabase.
2. Ejecuta `supabase_setup.sql` en SQL Editor.
3. Copia la Project URL y la Publishable key a `config.js`.
4. Sube los archivos a GitHub Pages.
5. En cada dispositivo pulsa **👥 Colaborar** y usa el mismo código de sala.

Se sincronizan recetas, stock, planificación semanal y lista de compra. Si dos dispositivos cambian a la vez el mismo estado, prevalece el último guardado.

No pongas nunca una `service_role` o `secret key` en `config.js`.


### Avisos entre dispositivos
La v5 muestra un aviso dentro de FrigoPlan cuando otro dispositivo conectado a la misma sala cambia stock, compras, planificación o recetas. Puedes activar además las notificaciones del navegador desde el cuadro Colaborar. Los avisos entre dispositivos requieren que ambos tengan FrigoPlan abierta o activa; las notificaciones push con la app completamente cerrada requieren una infraestructura Web Push adicional.
