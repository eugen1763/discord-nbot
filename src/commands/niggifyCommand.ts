import { 
    ChatInputCommandInteraction, 
    GuildMember, 
    VoiceBasedChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ButtonInteraction
} from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    VoiceConnection,
    AudioPlayer
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

        // Set up a voice state change listener to follow the user if they change channels
        const voiceStateHandler = (oldState: any, newState: any) => {
            // Check if this is our target user
            if (newState.member.id === targetUser.id) {
                // If user switched to another channel (not disconnected)
                if (oldState.channelId !== newState.channelId && 
                    newState.channelId !== null && 
                    isPlaying) {
                    // Follow the user to their new channel
                    const newChannel = newState.channel;
                    if (newChannel) {
                        console.log(`${targetUser.displayName} moved to ${newChannel.name}. Following...`);

                        // Destroy the old connection
                        connection.destroy();

                        // Join the new channel
                        const newConnection = joinVoiceChannel({
                            channelId: newChannel.id,
                            guildId: interaction.guild!.id,
                            adapterCreator: interaction.guild!.voiceAdapterCreator,
                        });

                        // Update our connection reference
                        connection = newConnection;
                        connection.subscribe(player);

                        // Update the reply
                        interaction.editReply({
                            content: `🎵 Following ${targetUser.displayName} to ${newChannel.name}...`,
                            components: [actionRow]
                        }).catch(() => {});
                    }
                }
            }
        };

        // Register the handler
        interaction.client.on('voiceStateUpdate', voiceStateHandler);

        // Create stop button
        const stopButton = new ButtonBuilder()
            .setCustomId('stop_sound')
            .setLabel('Stop Sound')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️');

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(stopButton);

        await interaction.editReply({
            content: `🎵 Joining ${voiceChannel.name} to play "${soundName}"...`,
            components: [actionRow]
        });

        // Join the voice channel
        let connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // Wait for the connection to be ready
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        } catch (error) {
            connection.destroy();
            await interaction.editReply({
                content: '❌ Failed to join the voice channel!',
                components: []
            });
            return;
        }

        // Create audio player and resource
        const player = createAudioPlayer();
        const resource = createAudioResource(soundPath);

        // Play the sound
        player.play(resource);
        connection.subscribe(player);

        let isPlaying = true;
        let buttonCollector: any = null;

        // Create button collector
        buttonCollector = interaction.channel?.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000, // 30 seconds timeout
            filter: (buttonInteraction) => buttonInteraction.customId === 'stop_sound' && buttonInteraction.user.id === interaction.user.id
        });

        buttonCollector?.on('collect', async (buttonInteraction: ButtonInteraction) => {
            if (buttonInteraction.customId === 'stop_sound') {
                isPlaying = false;
                player.stop();
                connection.destroy();
                
                // Remove voice state listener
                interaction.client.removeAllListeners('voiceStateUpdate');

                await buttonInteraction.update({
                    content: `⏹️ Sound stopped! Bot has left ${voiceChannel.name}.`,
                    components: []
                });
                
                buttonCollector?.stop();
            }
        });

        buttonCollector?.on('end', () => {
            if (isPlaying) {
                // Remove buttons when collector expires
                interaction.editReply({
                    content: `🎵 Playing "${soundName}" in ${voiceChannel.name}...`,
                    components: []
                }).catch(() => {});
            }
        });

        // Handle player events
        player.on(AudioPlayerStatus.Playing, () => {
            console.log(`Playing sound "${soundName}" in ${voiceChannel.name}`);
        });

        player.on('error', error => {
            console.error('Audio player error:', error);
            isPlaying = false;
            connection.destroy();
            buttonCollector?.stop();

            // Remove voice state listener
            interaction.client.removeAllListeners('voiceStateUpdate');

            interaction.editReply({
                content: '❌ An error occurred while playing the sound!',
                components: []
            }).catch(() => {});
        });

        // Leave the channel when the sound finishes playing
        player.on(AudioPlayerStatus.Idle, () => {
            if (isPlaying) {
                console.log(`Finished playing "${soundName}". Leaving channel.`);
                isPlaying = false;
                connection.destroy();
                buttonCollector?.stop();

                // Remove voice state listener
                interaction.client.removeAllListeners('voiceStateUpdate');

                interaction.editReply({
                    content: `✅ Finished playing "${soundName}" in ${voiceChannel.name}.`,
                    components: []
                }).catch(() => {});
            }
        });

        // Also handle connection state changes
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                if (isPlaying) {
                    isPlaying = false;
                    connection.destroy();
                    buttonCollector?.stop();
                }
            }
        });

        // Set a timeout to ensure we don't stay in the channel forever
        setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed && isPlaying) {
                isPlaying = false;
                connection.destroy();
                buttonCollector?.stop();

                // Remove voice state listener
                interaction.client.removeAllListeners('voiceStateUpdate');

                interaction.editReply({
                    content: `⏰ Sound timed out. Bot has left ${voiceChannel.name}.`,
                    components: []
                }).catch(() => {});
            }
        }, 30000); // 30 seconds max

    } catch (error) {
        console.error('Error in niggify command:', error);
        await interaction.editReply({
            content: '❌ An error occurred while trying to play the sound!',
            components: []
        });
    }
};