import {
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Address = { name: string; latitude: number; longitude: number };

@Injectable()
export class GeocodingService {
  private readonly cache = new Map<
    string,
    { expires: number; items: Address[] }
  >();
  private readonly pending = new Map<string, Promise<Address[]>>();
  private queue: Promise<unknown> = Promise.resolve();
  private nextRequestAt = 0;
  private cooldownUntil = 0;

  constructor(private readonly config: ConfigService) {}

  async search(search: string): Promise<Address[]> {
    const key = search.trim().normalize('NFC').toLocaleLowerCase('vi');
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.items;
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= 5)
      throw new HttpException(
        'Đang có nhiều lượt tìm địa chỉ. Vui lòng thử lại sau.',
        429,
      );

    const task = this.queue.then(() => this.fetchAddresses(key));
    this.pending.set(key, task);
    this.queue = task.catch(() => undefined);
    try {
      const items = await task;
      if (this.cache.size >= 200)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { items, expires: Date.now() + 86400000 });
      return items;
    } finally {
      this.pending.delete(key);
    }
  }

  private async fetchAddresses(query: string): Promise<Address[]> {
    if (Date.now() < this.cooldownUntil)
      throw new HttpException(
        'Dịch vụ địa chỉ đang bận. Vui lòng thử lại sau một phút.',
        429,
      );
    const delay = Math.max(0, this.nextRequestAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    this.nextRequestAt = Date.now() + 1100;
    const url = new URL(
      this.config.get<string>('NOMINATIM_SEARCH_URL') ||
        'https://nominatim.openstreetmap.org/search',
    );
    url.search = new URLSearchParams({
      q: `${query}, Hà Nội`,
      format: 'json',
      limit: '5',
      countrycodes: 'vn',
      viewbox: '105.65,21.15,105.95,20.90',
      bounded: '1',
      'accept-language': 'vi',
    }).toString();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent':
            'GoBus-JourneyPlanner/1.0 (Hanoi student bus journey planner)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        if (response.status === 429) this.cooldownUntil = Date.now() + 60000;
        throw new Error('Geocoding provider unavailable');
      }
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid geocoding response');
      return data
        .flatMap((item: Record<string, unknown>) => {
          if (
            !item ||
            typeof item.display_name !== 'string' ||
            typeof item.lat !== 'string' ||
            typeof item.lon !== 'string'
          )
            return [];
          const latitude = parseFloat(item.lat);
          const longitude = parseFloat(item.lon);
          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < 20.9 ||
            latitude > 21.15 ||
            longitude < 105.65 ||
            longitude > 105.95
          )
            return [];
          return [
            { name: item.display_name.slice(0, 1000), latitude, longitude },
          ];
        })
        .slice(0, 5);
    } catch {
      throw new ServiceUnavailableException(
        'Chưa tìm được địa chỉ. Bạn có thể chọn trạm xe hoặc thử lại sau.',
      );
    }
  }
}
