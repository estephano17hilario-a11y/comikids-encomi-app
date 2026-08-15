package com.incomi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class ComikidsWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.comikids_appwidget_layout);

        SharedPreferences prefs = context.getSharedPreferences("comikids_widget_prefs", Context.MODE_PRIVATE);
        int almacen = prefs.getInt("count_almacen", 0);
        int alistando = prefs.getInt("count_alistando", 0);
        int ruta = prefs.getInt("count_ruta", 0);

        views.setTextViewText(R.id.widget_count_almacen, String.valueOf(almacen));
        views.setTextViewText(R.id.widget_count_alistando, String.valueOf(alistando));
        views.setTextViewText(R.id.widget_count_ruta, String.valueOf(ruta));

        // Configurar acción al tocar el widget: abrir MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root_layout, pendingIntent);

        // Actualizar el widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}

