import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
@WebSocketGateway({
    cors: {
        origin: '*', // Allow connections from frontend
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
export class MarketGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) {}

    afterInit(server: Server) {
        console.log('⚡ WebSockets MarketGateway initialized successfully');
    }

    handleConnection(client: Socket) {
        console.log(`🔌 Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`❌ Client disconnected: ${client.id}`);
    }

    // Subscribe to a specific stock symbol room (e.g. HPG)
    @SubscribeMessage('subscribe_instrument')
    handleSubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody('symbol') symbol: string,
    ) {
        const room = `room:${symbol.toUpperCase()}`;
        client.join(room);
        console.log(`📈 Client ${client.id} joined room: ${room}`);
        return { status: 'subscribed', room };
    }

    // Unsubscribe from a stock symbol room
    @SubscribeMessage('unsubscribe_instrument')
    handleUnsubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody('symbol') symbol: string,
    ) {
        const room = `room:${symbol.toUpperCase()}`;
        client.leave(room);
        console.log(`📉 Client ${client.id} left room: ${room}`);
        return { status: 'unsubscribed', room };
    }

    // Initialize Redis subscription for real-time high frequency ticker stream on start
    async onModuleInit() {
        console.log('🔗 Connecting WebSocket Gateway to Redis Pub/Sub...');
        const subClient = this.redis.getClient().duplicate();
        
        // Subscribe to all instrument pubsub channels
        await subClient.psubscribe('market:pubsub:*');
        
        subClient.on('pmessage', (pattern, channel, message) => {
            try {
                const tickData = JSON.parse(message);
                
                const broadcastPayload = {
                    symbol: tickData.symbol,
                    price: Number(tickData.price),
                    change: Number(tickData.change),
                    changePercent: Number(tickData.changePercent),
                    timestamp: new Date(tickData.time).getTime(),
                };

                // 1. Broadcast to specific symbol room (e.g. room:HPG)
                const room = `room:${tickData.symbol.toUpperCase()}`;
                this.server.to(room).emit('instrument_tick', broadcastPayload);

                // 2. Broadcast globally to update Dashboard Movers
                this.server.emit('global_market_tick', broadcastPayload);
            } catch (err) {
                console.error('❌ Failed to parse and broadcast Redis tick message:', err);
            }
        });

        console.log('✅ WebSocket Gateway successfully listening to Redis Pub/Sub channels');
    }
}
