import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Station } from './station.entity.js';

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(Station)
    private readonly stationsRepository: Repository<Station>,
  ) {}

  findAll(): Promise<Station[]> {
    return this.stationsRepository.find();
  }
}