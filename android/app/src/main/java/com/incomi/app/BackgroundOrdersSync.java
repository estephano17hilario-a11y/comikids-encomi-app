package com.incomi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class BackgroundOrdersSync {

    private static final String SUPABASE_URL = "https://api.89.117.73.97.sslip.io/rest/v1/pedidos?select=id,codigo_seguimiento,destino_detalle,estado_envio,estado_produccion,created_at,usuario:usuarios(nombre_completo,telefono_default)&order=created_at.desc&limit=30";
    private static final String SUPABASE_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU";
    private static final String CHANNEL_ID = "comikids_orders_high_priority";

    private static ScheduledExecutorService scheduler;
    private static boolean isRunning = false;

    public static synchronized void startPeriodicSync(Context appContext) {
        if (isRunning) return;
        isRunning = true;

        scheduler = Executors.newSingleThreadScheduledExecutor();
        // Polling nativo en segundo plano cada 8 segundos
        scheduler.scheduleWithFixedDelay(() -> {
            try {
                fetchOrdersAndSync(appContext);
            } catch (Exception e) {
                // Non-fatal error during background sync
            }
        }, 1, 8, TimeUnit.SECONDS);
    }

    public static void fetchOrdersAndSync(Context context) {
        try {
            URL url = new URL(SUPABASE_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                JSONArray pedidosArray = new JSONArray(response.toString());
                processFetchedOrders(context, pedidosArray);
            }
            conn.disconnect();
        } catch (Exception ignored) {
        }
    }

    private static void processFetchedOrders(Context context, JSONArray pedidosArray) {
        SharedPreferences prefs = context.getSharedPreferences("comikids_widget_prefs", Context.MODE_PRIVATE);
        Set<String> knownIds = new HashSet<>(prefs.getStringSet("known_order_ids", new HashSet<>()));
        boolean isFirstRun = prefs.getBoolean("is_first_sync_run", true);

        int countAlmacen = 0;
        int countAlistando = 0;
        int countRuta = 0;
        JSONArray widgetOrders = new JSONArray();
        Set<String> currentIds = new HashSet<>();

        for (int i = 0; i < pedidosArray.length(); i++) {
            JSONObject p = pedidosArray.optJSONObject(i);
            if (p == null) continue;

            String id = p.optString("id", "");
            String code = p.optString("codigo_seguimiento", "");
            String dest = p.optString("destino_detalle", "Destino");
            String estadoEnvio = p.optString("estado_envio", "pendiente");
            String estadoProd = p.optString("estado_produccion", "en_cola");

            JSONObject user = p.optJSONObject("usuario");
            String clientName = user != null ? user.optString("nombre_completo", "Cliente") : "Cliente";
            String phone = user != null ? user.optString("telefono_default", "") : "";

            currentIds.add(id);

            // Determinar estado amigable
            String estadoDisplay;
            if (estadoEnvio.equals("en_camino") || (estadoProd.equals("completado") && estadoEnvio.equals("pendiente"))) {
                estadoDisplay = "En Ruta";
                countRuta++;
            } else if (estadoProd.equals("bordando") && estadoEnvio.equals("pendiente")) {
                estadoDisplay = "Alistando";
                countAlistando++;
            } else if (estadoEnvio.equals("entregado")) {
                estadoDisplay = "Entregado";
            } else {
                estadoDisplay = "Almacén";
                countAlmacen++;
            }

            // Si no está entregado, agregarlo al widget
            if (!estadoEnvio.equals("entregado") && widgetOrders.length() < 10) {
                try {
                    JSONObject wo = new JSONObject();
                    wo.put("codigo", code);
                    wo.put("nombre", clientName);
                    wo.put("telefono", phone);
                    wo.put("destino", dest);
                    wo.put("estado", estadoDisplay);
                    widgetOrders.put(wo);
                } catch (Exception ignored) {}
            }

            // Si es un nuevo pedido y NO es la primera ejecución tras instalar, notificar nativamente
            if (!isFirstRun && !knownIds.contains(id)) {
                sendWakeupNotification(context, code, clientName, dest);
            }
        }

        // Guardar estado actualizado en SharedPreferences
        prefs.edit()
            .putInt("count_almacen", countAlmacen)
            .putInt("count_alistando", countAlistando)
            .putInt("count_ruta", countRuta)
            .putString("orders_json", widgetOrders.toString())
            .putStringSet("known_order_ids", currentIds)
            .putBoolean("is_first_sync_run", false)
            .apply();

        // Actualizar todos los widgets en la pantalla de inicio
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, ComikidsWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int widgetId : appWidgetIds) {
            ComikidsWidgetProvider.updateAppWidget(context, appWidgetManager, widgetId);
        }
    }

    public static void sendWakeupNotification(Context context, String code, String clientName, String dest) {
        // 1. Despertar pantalla si está apagada
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "Encomi:WakeUpNewOrder"
                );
                wakeLock.acquire(4000);
            }
        } catch (Exception ignored) {}

        // 2. Emitir Notificación Nativa de Alta Prioridad con Sonido y Vibración
        try {
            createNotificationChannel(context);

            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            String title = "📦 ¡Nuevo Pedido #" + code + "!";
            String body = clientName + " registró un nuevo envío para: " + dest;

            NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setAutoCancel(true)
                    .setSound(defaultSoundUri)
                    .setVibrate(new long[]{0, 400, 250, 400})
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setContentIntent(pendingIntent);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            int notificationId = (int) System.currentTimeMillis();
            notificationManager.notify(notificationId, notificationBuilder.build());
        } catch (Exception ignored) {}
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Alertas de Nuevos Pedidos Encomi";
            String description = "Notificaciones instantáneas de pedidos creados con pantalla apagada";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 400, 250, 400});

            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
