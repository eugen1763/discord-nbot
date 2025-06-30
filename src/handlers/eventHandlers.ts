import { Client, Message } from 'discord.js';
import { Player } from 'discord-player';
import { COMMAND_DEFINITIONS } from '../commands/commandDefinitions';

export const setupEventHandlers = (client: Client, player: Player): void => {
    client.once('ready', () => {
        console.log(`Ready! Logged in as ${client.user?.tag}`);
    });

    client.on('error', console.error);
    client.on('warn', console.warn);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (error: Error) => {
        console.error('Unhandled promise rejection:', error);
    });

    player.on("error", (error) => {
        console.log(`Error emitted from the queue: ${error.message}`);
    });

    client.on("messageCreate", async (message: Message) => {
        if (message.author.bot || !message.guild) return;
        if (!client.application?.owner) await client.application?.fetch();

        if (message.content === "!deploy" && message.author.id === client.application?.owner?.id) {
            await message.guild.commands.set(COMMAND_DEFINITIONS);
            await message.reply("Deployed!");
        }

        if (message.mentions.has(client.user!)) {
            await message.reply('Hi! You can use commands with the prefix "!"');
        }
    });
};