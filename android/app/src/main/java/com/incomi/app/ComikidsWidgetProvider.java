package com.incomi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

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
        String ordersJsonStr = prefs.getString("orders_json", "[]");

        views.setTextViewText(R.id.widget_count_almacen, String.valueOf(almacen));
        views.setTextViewText(R.id.widget_count_alistando, String.valueOf(alistando));
        views.setTextViewText(R.id.widget_count_ruta, String.valueOf(ruta));

        // Cargar y mostrar los recuadros de pedidos activos
        try {
            JSONArray orders = new JSONArray(ordersJsonStr);
            int count = orders.length();

            if (count == 0) {
                views.setViewVisibility(R.id.widget_empty_text, View.VISIBLE);
                views.setViewVisibility(R.id.widget_item_1_layout, View.GONE);
                views.setViewVisibility(R.id.widget_item_2_layout, View.GONE);
                views.setViewVisibility(R.id.widget_item_3_layout, View.GONE);
            } else {
                views.setViewVisibility(R.id.widget_empty_text, View.GONE);

                // Slot 1
                if (count >= 1) {
                    JSONObject o1 = orders.getJSONObject(0);
                    views.setViewVisibility(R.id.widget_item_1_layout, View.VISIBLE);
                    views.setTextViewText(R.id.widget_item_1_name, o1.optString("nombre", "Cliente") + " • #" + o1.optString("codigo", ""));
                    String phone1 = o1.optString("telefono", "");
                    views.setTextViewText(R.id.widget_item_1_phone, phone1.isEmpty() ? "📱 Sin teléfono" : "📱 +51 " + phone1.replaceFirst("^51", ""));
                    views.setTextViewText(R.id.widget_item_1_dest, "📍 " + o1.optString("destino", ""));
                    views.setTextViewText(R.id.widget_item_1_status, o1.optString("estado", "Alistando"));
                } else {
                    views.setViewVisibility(R.id.widget_item_1_layout, View.GONE);
                }

                // Slot 2
                if (count >= 2) {
                    JSONObject o2 = orders.getJSONObject(1);
                    views.setViewVisibility(R.id.widget_item_2_layout, View.VISIBLE);
                    views.setTextViewText(R.id.widget_item_2_name, o2.optString("nombre", "Cliente") + " • #" + o2.optString("codigo", ""));
                    String phone2 = o2.optString("telefono", "");
                    views.setTextViewText(R.id.widget_item_2_phone, phone2.isEmpty() ? "📱 Sin teléfono" : "📱 +51 " + phone2.replaceFirst("^51", ""));
                    views.setTextViewText(R.id.widget_item_2_dest, "📍 " + o2.optString("destino", ""));
                    views.setTextViewText(R.id.widget_item_2_status, o2.optString("estado", "En Ruta"));
                } else {
                    views.setViewVisibility(R.id.widget_item_2_layout, View.GONE);
                }

                // Slot 3
                if (count >= 3) {
                    JSONObject o3 = orders.getJSONObject(2);
                    views.setViewVisibility(R.id.widget_item_3_layout, View.VISIBLE);
                    views.setTextViewText(R.id.widget_item_3_name, o3.optString("nombre", "Cliente") + " • #" + o3.optString("codigo", ""));
                    String phone3 = o3.optString("telefono", "");
                    views.setTextViewText(R.id.widget_item_3_phone, phone3.isEmpty() ? "📱 Sin teléfono" : "📱 +51 " + phone3.replaceFirst("^51", ""));
                    views.setTextViewText(R.id.widget_item_3_dest, "📍 " + o3.optString("destino", ""));
                    views.setTextViewText(R.id.widget_item_3_status, o3.optString("estado", "Almacén"));
                } else {
                    views.setViewVisibility(R.id.widget_item_3_layout, View.GONE);
                }
            }
        } catch (Exception e) {
            views.setViewVisibility(R.id.widget_empty_text, View.VISIBLE);
        }

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


