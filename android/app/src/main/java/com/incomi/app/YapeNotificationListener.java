package com.incomi.app;

import android.app.Notification;
import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.speech.tts.TextToSpeech;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class YapeNotificationListener extends NotificationListenerService implements TextToSpeech.OnInitListener {

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

        // 1. Filtrar solo notificaciones de Yape
        String packageName = sbn.getPackageName();
        if (packageName == null || !packageName.equals("com.bcp.innovacxion.yapeapp")) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = extras.getString(Notification.EXTRA_TITLE, "");
        CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
        String text = textSeq != null ? textSeq.toString() : "";
        String fullContent = title + " " + text;

        // 2. Detectar si es un pago entrante
        String lower = fullContent.toLowerCase();
        boolean isPayment = lower.contains("te envió") ||
                            lower.contains("te yapeó") ||
                            lower.contains("te yapeo") ||
                            lower.contains("recibiste un yape") ||
                            (fullContent.contains("S/") && (lower.contains("envió") || lower.contains("yapeó") || lower.contains("recibiste") || lower.contains("yapearon")));

        if (!isPayment) return;

        // 3. Extraer Remitente y Monto
        String horaActual = new SimpleDateFormat("h:mm a", new Locale("es", "PE")).format(new Date());
        String mensajeVoz;

        Pattern pattern = Pattern.compile("(?i)(.+?)\\s+te\\s+(?:envió|yapeó|yapeo|envio)\\s+S/?\\s*([0-9]+(?:[.,][0-9]{1,2})?)");
        Matcher matcher = pattern.matcher(fullContent);

        if (matcher.find()) {
            String remitente = matcher.group(1);
            if (remitente == null) remitente = "Alguien";
            remitente = remitente.replace("¡", "").replace("!", "").trim();
            String monto = matcher.group(2);
            if (monto == null) monto = "";
            monto = monto.replace(",", ".");
            mensajeVoz = "Nuevo yape de " + remitente + ", " + monto + " soles, a las " + horaActual;
        } else {
            String cleanText = fullContent.replace("¡", "").replace("!", "").trim();
            if (cleanText.length() > 100) cleanText = cleanText.substring(0, 100);
            mensajeVoz = "Pago de Yape recibido: " + cleanText;
        }

        hablarConWakeLock(mensajeVoz);
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
