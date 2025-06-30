import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SoundManager } from '../soundManager';

export const handleListSoundsCommand = async (
    interaction: ChatInputCommandInteraction,
    soundManager: SoundManager
): Promise<void> => {
    const allSounds = soundManager.getAllSounds();
    
    if (allSounds.length === 0) {
        await interaction.reply({
            content: '📂 No sounds stored yet. Use `/addsound` to add some!',
            ephemeral: true
        });
        return;
    }

    // Create paginated list if there are many sounds
    const soundsPerPage = 10;
    const totalPages = Math.ceil(allSounds.length / soundsPerPage);
    const currentPage = 1;
    
    const startIndex = (currentPage - 1) * soundsPerPage;
    const endIndex = startIndex + soundsPerPage;
    const currentSounds = allSounds.slice(startIndex, endIndex);
    
    const soundsList = currentSounds.map((sound, index) => {
        const soundInfo = soundManager.getSoundInfo(sound);
        const size = soundInfo ? `(${Math.round(soundInfo.size / 1024)} KB)` : '';
        return `${startIndex + index + 1}. ${sound} ${size}`;
    }).join('\n');
    
    const listEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🎵 Stored Sounds')
        .setDescription(soundsList)
        .setFooter({ text: `Page ${currentPage}/${totalPages} • Total sounds: ${allSounds.length}` })
        .setTimestamp();

    await interaction.reply({ embeds: [listEmbed] });
};