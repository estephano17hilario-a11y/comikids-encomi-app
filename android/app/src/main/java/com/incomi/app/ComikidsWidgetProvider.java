package com.incomi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class ComikidsWidgetProvider extends AppWidgetProvider {

    // Color hex por estado (únicos y distintos)
    private static String getStatusColor(String estado) {
        if (estado == null) return "#94A3B8";
        switch (estado.toLowerCase()) {
            case "en_cola":
            case "en cola":
            case "almacén":
            case "almacen":
            case "en almacen":
            case "en almacén":
                return "#FBBF24"; // Amber — En Almacén
            case "alistando":
            case "alistandolo":
                return "#C084FC"; // Purple — Alistando
            case "en_ruta":
            case "en ruta":
            case "despachado":
            case "en_camino":
            case "en camino":
                return "#38BDF8"; // Sky Blue — En Ruta
            case "entregado":
            case "delivered":
                return "#34D399"; // Emerald — Entregado
            case "pendiente":
                return "#FB923C"; // Orange — Pendiente
            default:
                return "#94A3B8"; // Slate — Desconocido
        }
    }

    private static String getStatusLabel(String estado) {
        if (estado == null) return "Pendiente";
        switch (estado.toLowerCase()) {
            case "en_cola": return "En Almacén";
            case "alistando": return "Alistando";
            case "en_ruta": return "En Ruta";
            case "entregado": return "Entregado";
            case "pendiente": return "Pendiente";
            default: return estado;
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        new Thread(() -> BackgroundOrdersSync.fetchOrdersAndSync(context)).start();
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences("comikids_widget_prefs", Context.MODE_PRIVATE);
        int almacen  = prefs.getInt("count_almacen", 0);
        int alistando = prefs.getInt("count_alistando", 0);
        int ruta      = prefs.getInt("count_ruta", 0);
        String ordersJsonStr = prefs.getString("orders_json", "[]");

        // Usamos el StackView via RemoteViewsService para todos los pedidos
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.comikids_appwidget_layout);

        views.setTextViewText(R.id.widget_count_almacen,  String.valueOf(almacen));
        views.setTextViewText(R.id.widget_count_alistando, String.valueOf(alistando));
        views.setTextViewText(R.id.widget_count_ruta,     String.valueOf(ruta));

        try {
            JSONArray orders = new JSONArray(ordersJsonStr);
            int count = orders.length();

            views.setTextViewText(R.id.widget_title_orders_count,
                count > 0 ? count + " Despachos Activos" : "Despachos Activos");

            // Pasar el JSON completo al RemoteViewsService via Intent
            Intent serviceIntent = new Intent(context, WidgetOrdersRemoteViewsService.class);
            serviceIntent.putExtra("orders_json", ordersJsonStr);
            serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);

            views.setRemoteAdapter(R.id.widget_orders_stack, serviceIntent);
            views.setEmptyView(R.id.widget_orders_stack, R.id.widget_empty_text);

        } catch (Exception e) {
            views.setTextViewText(R.id.widget_title_orders_count, "Despachos Activos");
        }

        // Click: abrir MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root_layout, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
