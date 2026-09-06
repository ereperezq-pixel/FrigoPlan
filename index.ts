import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const payload = await req.json();
    const record = payload?.record || payload?.new_record || {};
    const data = record?.data || {};
    const meta = data?._meta || {};
    const roomId = record?.room_id;

    if (!roomId || !meta?.sourceId) {
      return Response.json({ ok: true, sent: 0, reason: 'No room/source metadata' });
    }

    const message = `${meta.deviceName || 'Otro dispositivo'}: ${meta.event || 'Datos actualizados'}`;
    const { data: rows, error } = await supabase
      .from('frigoplan_push_subscriptions')
      .select('endpoint, device_id, subscription')
      .eq('room_id', roomId)
      .neq('device_id', meta.sourceId);

    if (error) throw error;

    let sent = 0;
    for (const row of rows || []) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({
          title: 'FrigoPlan',
          body: message,
          url: './'
        }));
        sent++;
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('frigoplan_push_subscriptions').delete().eq('endpoint', row.endpoint);
        } else {
          console.error('Push error', status, err);
        }
      }
    }

    return Response.json({ ok: true, sent });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
