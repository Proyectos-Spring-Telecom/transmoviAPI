export interface ApiResponseCommon {
  data: any[];
  paginated?: Paginated;
}

export interface Paginated {
  total: number;
  page: number;
  lastPage: number;
}

export interface ApiCrudResponse {
  status: string;
  message: string;
  estatus?:ApiEstatus
  data?: ApiData;
}

export interface ApiData {
  id: number;
  nombre: string;
}

export interface ApiEstatus {
  estatus: number;
}
