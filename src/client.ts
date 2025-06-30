import { Client, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import config from '../config.json';

export const client = new Client({
    intents: [
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent
    ]
});

export const player = new Player(client);

export const initializeClient = async (): Promise<void> => {
    await client.login(config.token);
};