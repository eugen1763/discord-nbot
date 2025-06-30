import { client, player, initializeClient } from './client';
import { SoundManager } from './soundManager';
import { setupEventHandlers } from './handlers/eventHandlers';
import { handleSlashCommand } from './handlers/commandHandler';
import { createSoundsDirectory } from './utils/fileUtils';

// Initialize the sound manager and create sounds directory
const soundManager = new SoundManager();
const soundsDir = createSoundsDirectory();

// Setup event handlers
setupEventHandlers(client, player);

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    await handleSlashCommand(interaction, soundManager, soundsDir);
});

// Initialize and start the client
initializeClient().catch(console.error);