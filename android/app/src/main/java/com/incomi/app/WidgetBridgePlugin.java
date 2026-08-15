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
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static final String CHANNEL_ID = "comikids_orders_high_priority";

    @PluginMethod
    public void updateWidgetCounts(PluginCall call) {
        int almacen = call.getInt("almacen", 0);
        int alistando = call.getInt("alistando", 0);
        int ruta = call.getInt("ruta", 0);
        String ordersJson = call.getString("ordersJson", "[]");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("comikids_widget_prefs", Context.MODE_PRIVATE);
        prefs.edit()
            .putInt("count_almacen", almacen)
            .putInt("count_alistando", alistando)
            .putInt("count_ruta", ruta)
            .putString("orders_json", ordersJson)
            .apply();

        // Actualizar todos los widgets activos en la pantalla de inicio
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, ComikidsWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

        for (int appWidgetId : appWidgetIds) {
            ComikidsWidgetProvider.updateAppWidget(context, appWidgetManager, appWidgetId);
        }

        call.resolve();
    }

    @PluginMethod
    public void showNativeNotification(PluginCall call) {
        String title = call.getString("title", "📦 ¡Nuevo Pedido ComiKids!");
        String body = call.getString("body", "Se ha registrado un nuevo despacho.");
        String orderCode = call.getString("orderCode", "");

        Context context = getContext();
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

        NotificationCompat.Builder notificationBuilder =
            new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setVibrate(new long[]{0, 300, 200, 300})
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pendingIntent);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        int notificationId = (int) System.currentTimeMillis();

        try {
            notificationManager.notify(notificationId, notificationBuilder.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("SecurityException notification permission: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Notification error: " + e.getMessage());
        }
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Alertas de Nuevos Pedidos ComiKids";
            String description = "Notificaciones instantáneas de pedidos creados";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300});

            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}

