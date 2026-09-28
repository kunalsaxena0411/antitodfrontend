/** Single raster tile URL for Carto Dark Matter (non-interactive thumbnails). */
export function cartoDarkTileUrl(lat: number, lon: number, z = 11): string {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  const sub = 'abcd'[Math.abs((x + y) % 4)];
  return `https://${sub}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`;
}
