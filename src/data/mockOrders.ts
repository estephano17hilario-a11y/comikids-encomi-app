import { Usuario, MetodoEnvio, Pedido, TallerConfig } from '../types/database.types';

export const INITIAL_TALLER_CONFIG: TallerConfig = {
  nombre_taller: 'Encomi Envíos',
  ruc_dni: '42020312ENCOMI',
  celular_taller: '+51 987 654 321',
  whatsapp_pedidos: '51987654321',
  direccion_taller: 'Av. Gamarra 1234, Oficina 402, La Victoria, Lima',
  ciudad_origen: 'Lima, Perú'
};

export const INITIAL_USUARIOS: Usuario[] = [];
export const INITIAL_PEDIDOS: Pedido[] = [];
