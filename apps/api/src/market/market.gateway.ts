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

    // Track active price simulation state in memory to maintain continuous, realistic random walks
    private simulatedPrices: Record<string, { price: number; original: number }> = {};

    constructor(private readonly prisma: PrismaService) {}

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

    // Initialize mock real-time high frequency ticker stream on start
    async onModuleInit() {
        // Retrieve seeded base prices from quotes or initialize defaults
        const symbols = ['HPG', 'FPT', 'VND', 'MSN', 'VNM', 'MWG'];
        
        for (const sym of symbols) {
            const latestQuote = await this.prisma.quote.findFirst({
                where: { symbol: sym },
                orderBy: { asOf: 'desc' },
            });
            const basePrice = latestQuote ? Number(latestQuote.price) : 25000;
            this.simulatedPrices[sym] = {
                price: basePrice,
                original: basePrice,
            };
        }

        // Broadcaster Interval: Simulate realistic price walk every 1.5 seconds
        setInterval(() => {
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            const state = this.simulatedPrices[randomSymbol];
            if (!state) return;

            // Small daily standard random walk (max 0.12% tick volatility)
            const tickVolatility = 0.0012;
            const changePercent = (Math.random() - 0.49) * tickVolatility; // mild upward bias
            const lastPrice = state.price;
            const newPrice = lastPrice * (1 + changePercent);
            
            // Update tracking state
            state.price = Math.round(newPrice);

            const change = state.price - state.original;
            const changePct = change / state.original;

            const tickData = {
                symbol: randomSymbol,
                price: state.price,
                change: change,
                changePercent: changePct,
                timestamp: Date.now(),
            };

            // 1. Broadcast to specific symbol channel (e.g. room:HPG)
            const room = `room:${randomSymbol}`;
            this.server.to(room).emit('instrument_tick', tickData);

            // 2. Broadcast globally to update Dashboard Movers
            this.server.emit('global_market_tick', tickData);

        }, 1500);
    }
}
