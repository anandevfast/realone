import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const mongo = config.get('database.mongo', { infer: true });
        if (!mongo) {
          throw new Error('Missing database.mongo config');
        }

        return {
          uri: `mongodb://${mongo.host}:${mongo.port}/${mongo.db}`,
          auth:
            mongo.user && mongo.password
              ? {
                  username: mongo.user,
                  password: mongo.password,
                }
              : undefined,
          maxPoolSize: 50,
          minPoolSize: 5,
        };
      },
    }),
  ],
})
export class MongoModule {}
