package com.incomi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class OrdersForegroundService extends Service {

    private static final String FOREGROUND_CHANNEL_ID = "comikids_service_channel";
    private static final int FOREGROUND_NOTIFICATION_ID = 99101;
    private ScheduledExecutorService executorService;
    private PowerManager.WakeLock wakeLock;

    public static void startService(Context context) {
        Intent intent = new Intent(context, OrdersForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createServiceChannel();

        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
            .setContentTitle("Encomi • Servicio de Notificaciones Activo")
            .setContentText("Monitoreando nuevos despachos en tiempo real")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build();

        startForeground(FOREGROUND_NOTIFICATION_ID, notification);

        // WakeLock parcial para asegurar que la CPU continúe consultando pedidos con pantalla apagada
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Encomi:BackgroundSyncWakeLock");
            wakeLock.acquire(10 * 60 * 1000L); // 10 min chunks
        }

        startBackgroundPolling();
    }

    private void startBackgroundPolling() {
        executorService = Executors.newSingleThreadScheduledExecutor();
        executorService.scheduleWithFixedDelay(() -> {
            try {
                BackgroundOrdersSync.fetchOrdersAndSync(getApplicationContext());
            } catch (Exception ignored) {
            }
        }, 1, 5, TimeUnit.SECONDS);
    }

    private void createServiceChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                FOREGROUND_CHANNEL_ID,
                "Servicio de Sincronización en Segundo Plano",
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Mantiene la app escuchando nuevos pedidos");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (executorService != null) {
            executorService.shutdown();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
