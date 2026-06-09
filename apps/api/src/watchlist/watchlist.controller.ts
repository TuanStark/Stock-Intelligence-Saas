import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  async getMyWatchlist(@Req() req: any) {
    return this.watchlistService.getOrCreateWatchlist(req.user.id);
  }

  @Post('items')
  async addItem(@Req() req: any, @Body('symbol') symbol: string) {
    return this.watchlistService.addWatchlistItem(req.user.id, symbol);
  }

  @Delete('items/:symbol')
  async removeItem(@Req() req: any, @Param('symbol') symbol: string) {
    return this.watchlistService.removeWatchlistItem(req.user.id, symbol);
  }
}
