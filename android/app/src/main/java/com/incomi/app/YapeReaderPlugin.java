package com.incomi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "YapeReader")
public class YapeReaderPlugin extends Plugin {

    private static final String CHANNEL_LIVE_ID = "comikids_live_ongoing_channel";
    private static final int NOTIFICATION_LIVE_ID = 90210;

    private BroadcastReceiver yapeReceiver;

    @Override
    public void load() {
        super.load();
        createLiveNotificationChannel();
        registerYapeBroadcastReceiver();
    }

    private void createLiveNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_LIVE_ID,
                "Transmisión TikTok Live Activa",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Mantiene la alerta continua mientras ComiKids está en vivo");
            channel.setShowBadge(true);
            channel.enableVibration(false);
            channel.setSound(null, null);

            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void registerYapeBroadcastReceiver() {
        yapeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (YapeNotificationListener.ACTION_YAPE_RECEIVED.equals(intent.getAction())) {
                    String sender = intent.getStringExtra("sender");
                    double amount = intent.getDoubleExtra("amount", 0.0);
                    boolean isLive = intent.getBooleanExtra("isLive", false);
                    String rawText = intent.getStringExtra("rawText");

                    JSObject data = new JSObject();
                    data.put("sender", sender);
                    data.put("amount", amount);
                    data.put("isLive", isLive);
                    data.put("rawText", rawText);
                    data.put("timestamp", System.currentTimeMillis());

                    notifyListeners("onYapeReceived", data);
                }
            }
        };

        IntentFilter filter = new IntentFilter(YapeNotificationListener.ACTION_YAPE_RECEIVED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(yapeReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(yapeReceiver, filter);
        }
    }

    @PluginMethod
    public void requestNotificationAccess(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir la pantalla de ajustes: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isNotificationAccessGranted(PluginCall call) {
        boolean granted = isServiceEnabled(getContext());
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void setLiveMode(PluginCall call) {
        Boolean isLive = call.getBoolean("isLive", false);
        if (isLive == null) isLive = false;

        SharedPreferences prefs = getContext().getSharedPreferences(
            YapeNotificationListener.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        prefs.edit().putBoolean(YapeNotificationListener.KEY_IS_LIVE, isLive).apply();

        if (isLive) {
            showOngoingLiveNotification();
        } else {
            cancelOngoingLiveNotification();
        }

        JSObject ret = new JSObject();
        ret.put("isLive", isLive);
        call.resolve(ret);
    }

    @PluginMethod
    public void getCapturedYapes(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(
                YapeNotificationListener.PREFS_NAME,
                Context.MODE_PRIVATE
            );
            String rawJson = prefs.getString(YapeNotificationListener.KEY_YAPES_LOG, "[]");
            JSONArray jsonArray = new JSONArray(rawJson);

            JSArray jsArray = new JSArray();
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject obj = jsonArray.getJSONObject(i);
                JSObject jsObj = new JSObject();
                jsObj.put("id", obj.optString("id"));
                jsObj.put("sender", obj.optString("sender"));
                jsObj.put("amount", obj.optDouble("amount", 0.0));
                jsObj.put("timestamp", obj.optLong("timestamp", System.currentTimeMillis()));
                jsObj.put("rawText", obj.optString("rawText"));
                jsObj.put("isLive", obj.optBoolean("isLive", false));
                jsArray.put(jsObj);
            }

            JSObject result = new JSObject();
            result.put("yapes", jsArray);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Error al obtener yapes: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearCapturedYapes(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            YapeNotificationListener.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        prefs.edit().putString(YapeNotificationListener.KEY_YAPES_LOG, "[]").apply();
        call.resolve();
    }

    private void showOngoingLiveNotification() {
        try {
            Context ctx = getContext();
            NotificationManager manager = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            Intent intent = new Intent(ctx, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                ctx,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_LIVE_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("ESTAMOS EN LIVE 🔴")
                .setContentText("ComiKids Live activo • Monitoreando ventas y Yape por voz")
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent);

            manager.notify(NOTIFICATION_LIVE_ID, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void cancelOngoingLiveNotification() {
        try {
            Context ctx = getContext();
            NotificationManager manager = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancel(NOTIFICATION_LIVE_ID);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private boolean isServiceEnabled(Context context) {
        if (context == null) return false;
        ComponentName cn = new ComponentName(context, YapeNotificationListener.class);
        String flat = Settings.Secure.getString(
            context.getContentResolver(),
            "enabled_notification_listeners"
        );
        return !TextUtils.isEmpty(flat) && flat.contains(cn.flattenToString());
    }

    @Override
    protected void handleOnDestroy() {
        if (yapeReceiver != null) {
            try {
                getContext().unregisterReceiver(yapeReceiver);
            } catch (Exception ignored) {}
        }
        super.handleOnDestroy();
    }
}
