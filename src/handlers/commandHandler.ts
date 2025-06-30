import { ChatInputCommandInteraction } from 'discord.js';
import { SoundManager } from '../soundManager';
import { handleAddSoundCommand } from '../commands/addSoundCommand';
import { handleListSoundsCommand } from '../commands/listSoundsCommand';
import { handleDeleteSoundCommand } from '../commands/deleteSoundCommand';
import { handleNiggifyCommand } from '../commands/niggifyCommand';
import { handleSabrifyCommand } from '../commands/sabrifyCommand';
import { handleUploadSoundCommand } from '../commands/uploadSoundCommand';

export const handleSlashCommand = async (
    interaction: ChatInputCommandInteraction,
    soundManager: SoundManager,
    soundsDir: string
): Promise<void> => {
    switch (interaction.commandName) {
        case 'addsound':
            await handleAddSoundCommand(interaction, soundManager, soundsDir);
            break;
        case 'listsounds':
            await handleListSoundsCommand(interaction, soundManager);
            break;
        case 'deletesound':
            await handleDeleteSoundCommand(interaction, soundManager);
            break;
        case 'uploadsound':
            await handleUploadSoundCommand(interaction, soundManager, soundsDir);
            break;
        case 'niggify':
            await handleNiggifyCommand(interaction, soundManager);
            break;
        case 'sabrify':
            await handleSabrifyCommand(interaction, soundManager);
            break;
        default:
            await interaction.reply({
                content: '❌ Unknown command!',
                flags: "Ephemeral"
            });
    }
};