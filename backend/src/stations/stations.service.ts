import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { Station } from './station.entity.js';
import type { StationDto } from './dto/station.dto.js';
import type { ListStationsDto } from './dto/list-stations.dto.js';

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(Station) private readonly stations: Repository<Station>,
  ) {}
  async findAll({ page, limit, search, is_active }: ListStationsDto) {
    const query = this.stations.createQueryBuilder('s');
    if (search) {
      const term = `%${search.replace(/[!%_]/g, (char) => `!${char}`)}%`;
      query.andWhere(
        "(s.code LIKE :term ESCAPE '!' OR s.name LIKE :term ESCAPE '!' OR s.address LIKE :term ESCAPE '!')",
        { term },
      );
    }
    if (is_active !== undefined)
      query.andWhere('s.is_active = :active', { active: is_active === 'true' });
    const [items, total] = await query
      .orderBy('s.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async create(dto: StationDto) {
    try {
      return await this.stations.save(
        this.stations.create({ ...dto, is_active: true }),
      );
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }
  async update(id: string, dto: StationDto) {
    try {
      return await this.stations.manager.transaction(async (manager) => {
        const station = await manager.findOne(Station, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!station) throw new NotFoundException('Không tìm thấy bến xe.');
        Object.assign(station, dto);
        return manager.save(station);
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }
  async setStatus(id: string, active: boolean) {
    return this.stations.manager.transaction(async (manager) => {
      const station = await manager.findOne(Station, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!station) throw new NotFoundException('Không tìm thấy bến xe.');
      if (!active) {
        const routes = await manager.query<
          { id: string; code: string; name: string }[]
        >(
          `
          SELECT r.id, r.code, r.name FROM routes r
          WHERE r.status = 'ACTIVE' AND (r.origin_station_id = ? OR r.destination_station_id = ?
            OR EXISTS (SELECT 1 FROM route_stops rs WHERE rs.route_id = r.id AND rs.station_id = ?))
          ORDER BY r.id FOR UPDATE`,
          [id, id, id],
        );
        if (routes.length)
          throw new ConflictException({
            message:
              'Không thể ngừng hoạt động: bến đang được tuyến hoạt động sử dụng. Hãy điều chỉnh hoặc ngừng các tuyến liên quan trước.',
            routes,
          });
      }
      station.is_active = active;
      return manager.save(station);
    });
  }
  private rethrowDuplicate(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY'
    )
      throw new ConflictException('Mã bến đã tồn tại. Vui lòng chọn mã khác.');
    throw error;
  }
}
