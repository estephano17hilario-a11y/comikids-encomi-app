package com.incomi.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class WidgetOrdersRemoteViewsService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        String ordersJson = intent.getStringExtra("orders_json");
        if (ordersJson == null) ordersJson = "[]";
        return new OrdersRemoteViewsFactory(getApplicationContext(), ordersJson);
    }

    static class OrdersRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

        private final Context context;
        private final String ordersJsonStr;
        private final List<JSONObject> orders = new ArrayList<>();

        OrdersRemoteViewsFactory(Context context, String ordersJson) {
            this.context = context;
            this.ordersJsonStr = ordersJson;
        }

        @Override
        public void onCreate() { loadOrders(); }

        @Override
        public void onDataSetChanged() { loadOrders(); }

        private void loadOrders() {
            orders.clear();
            try {
                JSONArray arr = new JSONArray(ordersJsonStr);
                for (int i = 0; i < arr.length(); i++) {
                    orders.add(arr.getJSONObject(i));
                }
            } catch (Exception e) {
                // JSON parse error — lista vacía
            }
        }

        @Override
        public void onDestroy() { orders.clear(); }

        @Override
        public int getCount() { return orders.size(); }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_order_item);
            try {
                JSONObject o = orders.get(position);
                String nombre  = o.optString("nombre", "Cliente");
                String codigo  = o.optString("codigo", "");
                String telefono = o.optString("telefono", "");
                String destino = o.optString("destino", "");
                String estado  = o.optString("estado", "pendiente");

                rv.setTextViewText(R.id.item_name,   nombre + " • #" + codigo);
                rv.setTextViewText(R.id.item_phone,  telefono.isEmpty() ? "📱 Sin teléfono" : "📱 +51 " + telefono.replaceFirst("^51", ""));
                rv.setTextViewText(R.id.item_dest,   "📍 " + destino);
                rv.setTextViewText(R.id.item_status, getStatusLabel(estado));

                // Color único por estado
                String colorHex = getStatusColor(estado);
                rv.setTextColor(R.id.item_status, Color.parseColor(colorHex));

            } catch (Exception ignored) {}
            return rv;
        }

        @Override
        public RemoteViews getLoadingView() { return null; }

        @Override
        public int getViewTypeCount() { return 1; }

        @Override
        public long getItemId(int position) { return position; }

        @Override
        public boolean hasStableIds() { return true; }

        // ── colores por estado ────────────────────────────────────────────────
        private static String getStatusColor(String estado) {
            if (estado == null) return "#94A3B8";
            switch (estado.toLowerCase()) {
                case "en_cola": case "en cola": case "almacén":
                case "almacen": case "en almacen": case "en almacén":
                    return "#FBBF24";  // Amber — En Almacén
                case "alistando": case "alistándolo":
                    return "#C084FC";  // Purple — Alistando
                case "en_ruta": case "en ruta": case "despachado":
                case "en_camino": case "en camino":
                    return "#38BDF8";  // Sky Blue — En Ruta
                case "entregado": case "delivered":
                    return "#34D399";  // Emerald — Entregado
                case "pendiente":
                    return "#FB923C";  // Orange — Pendiente
                default:
                    return "#94A3B8";
            }
        }

        private static String getStatusLabel(String estado) {
            if (estado == null) return "Pendiente";
            switch (estado.toLowerCase()) {
                case "en_cola":   return "📦 En Almacén";
                case "alistando": return "🔧 Alistando";
                case "en_ruta":   return "🚚 En Ruta";
                case "entregado": return "✅ Entregado";
                case "pendiente": return "⏳ Pendiente";
                default:          return estado;
            }
        }
    }
}
