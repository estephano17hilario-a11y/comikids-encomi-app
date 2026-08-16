package com.incomi.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(YapeReaderPlugin.class);
        super.onCreate(savedInstanceState);

        // Iniciar servicio en primer plano para recibir notificaciones continuas con pantalla apagada
        OrdersForegroundService.startService(getApplicationContext());
        BackgroundOrdersSync.startPeriodicSync(getApplicationContext());
    }

    @Override
    public void onResume() {
        super.onResume();
        // Sincronizar y refrescar inmediatamente al entrar en primer plano
        Context context = getApplicationContext();
        new Thread(() -> BackgroundOrdersSync.fetchOrdersAndSync(context)).start();
    }
}


