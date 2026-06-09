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
import { AlertService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  async getMyAlerts(@Req() req: any) {
    return this.alertService.getUserAlerts(req.user.id);
  }

  @Post()
  async createAlert(
    @Req() req: any,
    @Body('symbol') symbol: string,
    @Body('type') type: string,
    @Body('threshold') threshold: number,
  ) {
    return this.alertService.createAlertRule(
      req.user.id,
      symbol,
      type,
      threshold,
    );
  }

  @Delete(':id')
  async deleteAlert(@Req() req: any, @Param('id') id: string) {
    return this.alertService.deleteAlertRule(req.user.id, id);
  }
}
