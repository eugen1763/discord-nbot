// src/commands/niggifyCommand.ts
import { 
    ChatInputCommandInteraction, 
    GuildMember, 
    VoiceBasedChannel 
} from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} from '@discordjs/voice';
import { SoundManager } from '../soundManager';

export const handleNiggifyCommand = async (
    interaction: ChatInputCommandInteraction,
    soundManager: SoundManager
): Promise<void> => {
    try {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user', true);
        const soundName = interaction.options.getString('soundname', true);

        // Check if the target user is a guild member
        if (!interaction.guild) {
            await interaction.editReply('❌ This command can only be used in a server!');
            return;
        }

        const targetMember = interaction.guild.members.cache.get(targetUser.id);
        if (!targetMember) {
            await interaction.editReply('❌ Target user not found in this server!');
            return;
        }

        // Check if the target user is in a voice channel
        const voiceChannel = targetMember.voice.channel;
        if (!voiceChannel) {
            await interaction.editReply(`❌ ${targetUser.displayName} is not in a voice channel!`);
            return;
        }

        // Check if bot has permissions to join the voice channel
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions?.has(['Connect', 'Speak'])) {
            await interaction.editReply('❌ I don\'t have permission to join that voice channel!');
            return;
        }

        // Check if the sound exists
        if (!soundManager.soundExists(soundName)) {
            await interaction.editReply(`❌ Sound "${soundName}" not found!`);
            return;
        }

        const soundPath = soundManager.getSoundPath(soundName);
        if (!soundPath) {
            await interaction.editReply(`❌ Could not get path for sound "${soundName}"!`);
            return;
        }

        await interaction.editReply(`🎵 Joining ${voiceChannel.name} to play "${soundName}"...`);

        // Join the voice channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // Wait for the connection to be ready
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        } catch (error) {
            connection.destroy();
            await interaction.editReply('❌ Failed to join the voice channel!');
            return;
        }

        // Create audio player and resource
        const player = createAudioPlayer();
        const resource = createAudioResource(soundPath);

        // Play the sound
        player.play(resource);
        connection.subscribe(player);

        // Handle player events
        player.on(AudioPlayerStatus.Playing, () => {
            console.log(`Playing sound "${soundName}" in ${voiceChannel.name}`);
        });

        player.on('error', error => {
            console.error('Audio player error:', error);
            connection.destroy();
        });

        // Leave the channel when the sound finishes playing
        player.on(AudioPlayerStatus.Idle, () => {
            console.log(`Finished playing "${soundName}". Leaving channel.`);
            connection.destroy();
        });

        // Also handle connection state changes
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                connection.destroy();
            }
        });

        // Set a timeout to ensure we don't stay in the channel forever
        setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        }, 30000); // 30 seconds max

    } catch (error) {
        console.error('Error in niggify command:', error);
        await interaction.editReply('❌ An error occurred while trying to play the sound!');
    }
};