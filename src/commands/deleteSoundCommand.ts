import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SoundManager } from '../soundManager';

export const handleDeleteSoundCommand = async (
    interaction: ChatInputCommandInteraction,
    soundManager: SoundManager
): Promise<void> => {
    const name = interaction.options.getString('name', true);
    
    if (!soundManager.soundExists(name)) {
        await interaction.reply({
            content: `❌ No sound found with the name "${name}".`,
            ephemeral: true
        });
        return;
    }

    const success = soundManager.deleteSound(name);
    
    if (success) {
        const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Sound Deleted')
            .setDescription(`Successfully deleted sound: **${name}**`)
            .setTimestamp();

        await interaction.reply({ embeds: [successEmbed] });
    } else {
        await interaction.reply({
            content: `❌ Failed to delete sound "${name}". Please try again.`,
            ephemeral: true
        });
    }
};