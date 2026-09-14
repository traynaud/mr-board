import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { FavoritesService } from './favorites.service';

/**
 * Local favorites store (RG-027-*). Exposes no controller of its own: the
 * only HTTP entry point is `MergeRequestsController`, which imports this
 * module — keeps the dependency one-directional and avoids the `forwardRef`
 * a `FavoritesController` resolving merge request ids would otherwise need
 * (architecture-backend.md §9).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Favorite])],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
