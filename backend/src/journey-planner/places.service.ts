import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SearchPlacesDto } from './dto/search-places.dto.js';

type PlaceRow = {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: string | number;
  longitude: string | number;
};

@Injectable()
export class PlacesService {
  constructor(private readonly db: DataSource) {}

  async search({ search, page, limit }: SearchPlacesDto) {
    // An empty autocomplete must not suggest the entire station catalog.
    if (!search) return { items: [], total: 0, page, limit, totalPages: 0 };

    const escaped = search.replace(/[!%_]/g, (character) => `!${character}`);
    const contains = `%${escaped}%`;
    const prefix = `${escaped}%`;
    // Explicit collation gives consistent Vietnamese case/accent matching.
    // ESCAPE '!' treats user-entered %, _ and ! as literal characters.
    const where = `s.is_active=1 AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      AND (s.name COLLATE utf8mb4_0900_ai_ci LIKE ? ESCAPE '!'
        OR s.code COLLATE utf8mb4_0900_ai_ci LIKE ? ESCAPE '!'
        OR s.address COLLATE utf8mb4_0900_ai_ci LIKE ? ESCAPE '!')`;
    const args = [contains, contains, contains];

    return this.db.transaction(async (manager) => {
      const [{ total }] = await manager.query<{ total: string | number }[]>(
        `SELECT COUNT(*) AS total FROM stations s WHERE ${where}`,
        args,
      );
      const rows = await manager.query<PlaceRow[]>(
        `SELECT CAST(s.id AS CHAR) AS id, s.code, s.name, s.address,
          s.latitude, s.longitude FROM stations s WHERE ${where}
         ORDER BY CASE
           WHEN s.code COLLATE utf8mb4_0900_ai_ci = ? OR s.name COLLATE utf8mb4_0900_ai_ci = ? THEN 0
           WHEN s.name COLLATE utf8mb4_0900_ai_ci LIKE ? ESCAPE '!'
             OR s.code COLLATE utf8mb4_0900_ai_ci LIKE ? ESCAPE '!' THEN 1
           ELSE 2 END,
           s.name COLLATE utf8mb4_0900_ai_ci, s.id
         LIMIT ? OFFSET ?`,
        [...args, search, search, prefix, prefix, limit, (page - 1) * limit],
      );
      return {
        items: rows.map((row) => ({
          ...row,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        })),
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      };
    });
  }
}
