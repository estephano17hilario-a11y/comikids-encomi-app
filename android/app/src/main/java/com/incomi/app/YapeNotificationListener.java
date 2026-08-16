package com.incomi.app;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.speech.tts.TextToSpeech;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class YapeNotificationListener extends NotificationListenerService implements TextToSpeech.OnInitListener {

    public static final String PREFS_NAME = "com.incomi.app.yape_prefs";
    public static final String KEY_IS_LIVE = "is_live_mode";
    public static final String KEY_YAPES_LOG = "saved_yapes_log";
    public static final String ACTION_YAPE_RECEIVED = "com.incomi.app.ACTION_YAPE_RECEIVED";

    private TextToSpeech tts;
    private boolean isTtsReady = false;

    @Override
    public void onCreate() {
        super.onCreate();
        tts = new TextToSpeech(this, this);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            int result = tts.setLanguage(new Locale("es", "PE"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(new Locale("es"));
            }
            isTtsReady = true;
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        super.onNotificationPosted(sbn);
        if (sbn == null) return;

        // 1. Filtrar notificaciones de Yape
        String packageName = sbn.getPackageName();
        if (packageName == null || !packageName.equals("com.bcp.innovacxion.yapeapp")) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = extras.getString(Notification.EXTRA_TITLE, "");
        CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
        String text = textSeq != null ? textSeq.toString() : "";
        String fullContent = (title + " " + text).trim();

        // 2. Detectar si es un pago entrante
        String lower = fullContent.toLowerCase();
        boolean isPayment = lower.contains("te envió") ||
                            lower.contains("te yapeó") ||
                            lower.contains("te yapeo") ||
                            lower.contains("recibiste un yape") ||
                            (fullContent.contains("S/") && (lower.contains("envió") || lower.contains("yapeó") || lower.contains("recibiste") || lower.contains("yapearon")));

        if (!isPayment) return;

        // 3. Extraer Remitente y Monto con Regex preciso
        String remitente = "Alguien";
        double montoNum = 0.0;
        String montoStr = "0";

        Pattern pattern = Pattern.compile("(?i)(.+?)\\s+te\\s+(?:envió|yapeó|yapeo|envio)\\s+S/?\\s*([0-9]+(?:[.,][0-9]{1,2})?)");
        Matcher matcher = pattern.matcher(fullContent);

        if (matcher.find()) {
            String matchRem = matcher.group(1);
            if (matchRem != null) {
                remitente = matchRem.replace("¡", "").replace("!", "").trim();
            }
            String matchMonto = matcher.group(2);
            if (matchMonto != null) {
                montoStr = matchMonto.replace(",", ".");
                try {
                    montoNum = Double.parseDouble(montoStr);
                } catch (Exception ignored) {}
            }
        } else {
            // Intentar extraer solo el monto y usar título/texto
            Pattern pMonto = Pattern.compile("S/?\\s*([0-9]+(?:[.,][0-9]{1,2})?)");
            Matcher mMonto = pMonto.matcher(fullContent);
            if (mMonto.find() && mMonto.group(1) != null) {
                montoStr = mMonto.group(1).replace(",", ".");
                try {
                    montoNum = Double.parseDouble(montoStr);
                } catch (Exception ignored) {}
            }
            if (title != null && !title.isEmpty()) {
                remitente = title.replace("¡", "").replace("!", "").trim();
            }
        }

        // 4. Leer preferencias compartidas (Modo Live)
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isLiveMode = prefs.getBoolean(KEY_IS_LIVE, false);

        // 5. Guardar en registro persistente (SIEMPRE ACTIVO, en Live o fuera de Live)
        try {
            String logsJson = prefs.getString(KEY_YAPES_LOG, "[]");
            JSONArray array = new JSONArray(logsJson);
            JSONObject yapeObj = new JSONObject();
            yapeObj.put("id", "yape_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000));
            yapeObj.put("sender", remitente);
            yapeObj.put("amount", montoNum > 0 ? montoNum : Double.parseDouble(montoStr.isEmpty() ? "0" : montoStr));
            yapeObj.put("timestamp", System.currentTimeMillis());
            yapeObj.put("rawText", fullContent);
            yapeObj.put("isLive", isLiveMode);
            array.put(yapeObj);

            prefs.edit().putString(KEY_YAPES_LOG, array.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 6. Notificar a la app activa vía Broadcast
        Intent broadcast = new Intent(ACTION_YAPE_RECEIVED);
        broadcast.putExtra("sender", remitente);
        broadcast.putExtra("amount", montoNum);
        broadcast.putExtra("isLive", isLiveMode);
        broadcast.putExtra("rawText", fullContent);
        sendBroadcast(broadcast);

        // 7. Si está en Modo Live, HABLAR POR VOZ con el formato exacto pedido:
        // "recibiste un yapeo de (nombre de la persona) de (monto) soles"
        if (isLiveMode) {
            String mensajeVoz = "Recibiste un yapeo de " + remitente + " de " + montoStr + " soles";
            hablarConWakeLock(mensajeVoz);
        }
    }

    private void hablarConWakeLock(String texto) {
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) return;

        @SuppressWarnings("deprecation")
        PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Encomi:YapeTTSWakeLock"
        );
        wakeLock.acquire(12000L);

        try {
            if (isTtsReady && tts != null) {
                tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "YAPE_TTS_" + System.currentTimeMillis());
            }
        } finally {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (wakeLock.isHeld()) {
                    wakeLock.release();
                }
            }, 10000L);
        }
    }

    @Override
    public void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }
}
