export type DeviceStatus = {
  online: boolean;
  page?: number;
  playing?: boolean;
  vol?: number;
  source?: string;
  wifi_rssi?: number | null;
  updatedAt?: string | null;
  title?: string;
  station?: string;
};

export type DeviceInfo = {
  device?: string;
  ip?: string;
  version?: string;
};

export type Station = {
  id: string;
  name: string;
  url: string;
  genre?: string;
};

export type Track = {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  url: string;
  source?: string;
  createdAt?: string;
};

export type GalleryItem = {
  id: string;
  name: string;
  type: string;
  url: string;
  createdAt?: string;
};
