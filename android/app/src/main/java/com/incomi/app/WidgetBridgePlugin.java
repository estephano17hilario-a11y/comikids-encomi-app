package com.incomi.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void updateWidgetCounts(PluginCall call) {
        int almacen = call.getInt("almacen", 0);
        int alistando = call.getInt("alistando", 0);
        int ruta = call.getInt("ruta", 0);

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("comikids_widget_prefs", Context.MODE_PRIVATE);
        prefs.edit()
            .putInt("count_almacen", almacen)
            .putInt("count_alistando", alistando)
            .putInt("count_ruta", ruta)
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
}
