// src/core/database/base.repository.ts
import type { Model, PipelineStage, UpdateQuery } from 'mongoose';
import { MongoQueryOptions } from './mongo-options.interface';

export type MongoFilter<T> =
  | Partial<Record<keyof T, any>>
  | Record<string, any>;

export abstract class BaseRepository<TDoc, TEntity = TDoc> {
  constructor(protected readonly model: Model<TDoc>) {}

  /* ---------------------------------- */
  /* FIND                               */
  /* ---------------------------------- */
  async find(
    filter: MongoFilter<TEntity> = {},
    projection: any = {},
    sort: any = {},
    skip = 0,
    limit = 0,
    opts: MongoQueryOptions = {},
  ): Promise<TEntity[]> {
    const query = this.model
      .find(filter as any, projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean<TEntity>()
      .read(opts.readPreference ?? 'secondaryPreferred');

    if (opts.hint) query.hint(opts.hint);
    if (opts.maxTimeMS) query.maxTimeMS(opts.maxTimeMS);

    return (await query.exec()) as TEntity[];
  }

  async findOne(
    filter: MongoFilter<TEntity>,
    projection: any = {},
    opts: MongoQueryOptions = {},
  ): Promise<TEntity | null> {
    const query = this.model
      .findOne(filter as any, projection)
      .lean<TEntity>()
      .read(opts.readPreference ?? 'secondaryPreferred');

    if (opts.hint) query.hint(opts.hint);
    if (opts.maxTimeMS) query.maxTimeMS(opts.maxTimeMS);

    return (await query.exec()) as TEntity | null;
  }

  /* ---------------------------------- */
  /* COUNT                              */
  /* ---------------------------------- */
  async countDocuments(
    filter: MongoFilter<TEntity>,
    opts: MongoQueryOptions = {},
  ): Promise<number> {
    let query = this.model.countDocuments(filter as any);

    if (opts.hint) query = query.hint(opts.hint);
    if (opts.maxTimeMS) query = query.maxTimeMS(opts.maxTimeMS);

    return query.exec();
  }

  async estimatedDocumentCount(): Promise<number> {
    return this.model.estimatedDocumentCount().exec();
  }

  /* ---------------------------------- */
  /* AGGREGATE                          */
  /* ---------------------------------- */
  async findAggregate<R = any>(
    pipeline: PipelineStage[],
    opts: MongoQueryOptions = {},
  ): Promise<R[]> {
    let agg = this.model.aggregate<R>(pipeline);

    if (opts.hint) agg = agg.hint(opts.hint);
    if (opts.allowDiskUse) agg = agg.allowDiskUse(true);
    else agg = agg.read('secondaryPreferred');

    return agg.exec();
  }

  /* ---------------------------------- */
  /* UPDATE                             */
  /* ---------------------------------- */
  async findOneAndUpdate(
    filter: MongoFilter<TEntity>,
    update: UpdateQuery<TEntity>,
    options: any = {},
  ): Promise<TEntity | null> {
    return this.model
      .findOneAndUpdate(filter as any, update as any, {
        new: true,
        lean: true,
        ...options,
      })
      .exec() as Promise<TEntity | null>;
  }

  async updateOne(
    filter: MongoFilter<TEntity>,
    update: UpdateQuery<TEntity>,
    options: any = {},
  ): Promise<any> {
    return this.model.updateOne(filter as any, update as any, options).exec();
  }

  async updateMany(
    filter: MongoFilter<TEntity>,
    update: UpdateQuery<TEntity>,
    options: any = {},
  ): Promise<any> {
    return this.model.updateMany(filter as any, update as any, options).exec();
  }

  /* ---------------------------------- */
  /* BULK                               */
  /* ---------------------------------- */
  async bulkWriteMany(operations: any[], options: any = {}): Promise<any> {
    return this.model.bulkWrite(operations, options);
  }

  /* ---------------------------------- */
  /* DELETE                             */
  /* ---------------------------------- */
  async deleteOne(filter: MongoFilter<TEntity>): Promise<any> {
    return this.model.deleteOne(filter as any).exec();
  }
}
