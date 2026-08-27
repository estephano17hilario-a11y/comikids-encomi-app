export interface ShalomAgency {
  id: number | string;
  code?: string | null;
  departamento: string;
  provincia: string;
  distrito: string;
  department?: string;
  province?: string;
  district?: string;
  ubigeo?: string | null;
  dep_id?: number | null;
  prov_id?: number | null;
  dist_id?: number | null;
  nombre: string;
  name?: string;
  full_name?: string;
  direccion: string;
  address?: string;
  phone?: string | null;
  telefono?: string | null;
  schedule?: string | null;
  horario?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number;
  is_active?: boolean;
  updated_at?: string;
  full_display_name?: string;
}
