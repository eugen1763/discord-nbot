import { 
    ChatInputCommandInteraction, 
    GuildMember, 
    VoiceChannel, 
    ChannelType, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ButtonInteraction
} from 'discord.js';
import { 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    VoiceConnection,
    AudioPlayer
} from '@discordjs/voice';
import { SoundManager } from '../soundManager';

export const handleSabrifyCommand = async (
    interaction: ChatInputCommandInteraction,
    soundManager: SoundManager
): Promise<void> => {
    const targetUser = interaction.options.getUser('user', true);
    const soundName = interaction.options.getString('soundname', true);

    // Check if we're in a guild
    if (!interaction.guild) {
        await interaction.reply({
            content: '❌ This command can only be used in a server!',
            flags: "Ephemeral"
        });
        return;
    }

    // Check if the sound exists
    if (!soundManager.soundExists(soundName)) {
        await interaction.reply({
            content: `❌ Sound "${soundName}" not found! Use \`/listsounds\` to see available sounds.`,
            flags: "Ephemeral"
        });
        return;
    }

    // Get the target user as a guild member
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
        await interaction.reply({
            content: '❌ User not found in this server!',
            flags: "Ephemeral"
        });
        return;
    }

    // Check if the target user is in a voice channel
    const originalVoiceChannel = targetMember.voice.channel;
    if (!originalVoiceChannel) {
        await interaction.reply({
            content: '❌ The specified user is not in a voice channel!',
            flags: "Ephemeral"
        });
        return;
    }

    // Check bot permissions
    const botMember = interaction.guild.members.me;
    if (!botMember) {
        await interaction.reply({
            content: '❌ Bot member not found!',
            flags: "Ephemeral"
        });
        return;
    }

    // Check if bot has required permissions
    const requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
    ];

    const missingPermissions = requiredPermissions.filter(perm =>
        !botMember.permissions.has(perm)
    );

    if (missingPermissions.length > 0) {
        await interaction.reply({
            content: '❌ Bot is missing required permissions: Manage Channels, Move Members, Connect, or Speak!',
            flags: "Ephemeral"
        });
        return;
    }

    await interaction.deferReply();

    let tempChannel: VoiceChannel | null = null;
    let connection: VoiceConnection | null = null;
    let player: AudioPlayer | null = null;
    let isPlaying = true;
    let buttonCollector: any = null;

    try {
        // Create temporary voice channel
        tempChannel = await interaction.guild.channels.create({
            name: 'Sabris Keller',
            type: ChannelType.GuildVoice,
            parent: originalVoiceChannel.parent, // Use same category as original channel
            permissionOverwrites: originalVoiceChannel.permissionOverwrites.cache.map(overwrite => ({
                id: overwrite.id,
                allow: overwrite.allow,
                deny: overwrite.deny,
                type: overwrite.type
            }))
        });

        // Move the user to the temporary channel
        await targetMember.voice.setChannel(tempChannel);

        // Set up a voice state change listener to move the user back if they leave
        const voiceStateHandler = (oldState: any, newState: any) => {
            // Check if this is our target user
            if (newState.member.id === targetUser.id) {
                // If user left our temp channel or switched to another channel
                if (oldState.channelId === tempChannel?.id && 
                    newState.channelId !== tempChannel?.id && 
                    isPlaying) {
                    // Move them back to our temp channel
                    newState.member.voice.setChannel(tempChannel!.id)
                        .catch((err: any) => console.error('Failed to move user back:', err));
                }
            }
        };

        // Register the handler
        interaction.client.on('voiceStateUpdate', voiceStateHandler);

        // Join the voice channel
        connection = joinVoiceChannel({
            channelId: tempChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // Wait for connection to be ready
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            connection!.on(VoiceConnectionStatus.Ready, () => {
                clearTimeout(timeout);
                resolve();
            });

            connection!.on(VoiceConnectionStatus.Disconnected, () => {
                clearTimeout(timeout);
                reject(new Error('Connection failed'));
            });
        });

        // Get sound path and create audio resource
        const soundPath = soundManager.getSoundPath(soundName);
        if (!soundPath) {
            throw new Error('Sound file not found');
        }

        const resource = createAudioResource(soundPath);
        player = createAudioPlayer();

        // Create stop button
        const stopButton = new ButtonBuilder()
            .setCustomId('stop_sabrify')
            .setLabel('Stop Sabrify')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️');

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(stopButton);

        // Play the sound
        player.play(resource);
        connection.subscribe(player);

        await interaction.editReply({
            content: `🎵 Playing "${soundName}" for ${targetUser.displayName} in Sabris Keller!`,
            components: [actionRow]
        });

        // Create button collector
        buttonCollector = interaction.channel?.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000, // 30 seconds timeout
            filter: (buttonInteraction) => buttonInteraction.customId === 'stop_sabrify' && buttonInteraction.user.id === interaction.user.id
        });

        buttonCollector?.on('collect', async (buttonInteraction: ButtonInteraction) => {
            if (buttonInteraction.customId === 'stop_sabrify') {
                isPlaying = false;
                
                // Remove voice state listener
                interaction.client.removeAllListeners('voiceStateUpdate');

                // Stop the player and destroy connection
                if (player) {
                    player.stop();
                }
                if (connection) {
                    connection.destroy();
                }

                // Move user back and clean up
                try {
                    const currentMember = await interaction.guild!.members.fetch(targetUser.id);
                    if (currentMember.voice.channel?.id === tempChannel?.id) {
                        await currentMember.voice.setChannel(originalVoiceChannel);
                    }
                    if (tempChannel) {
                        await tempChannel.delete();
                    }
                } catch (cleanupError) {
                    console.error('Error during cleanup:', cleanupError);
                }

                await buttonInteraction.update({
                    content: `⏹️ Sabrify stopped! ${targetUser.displayName} has been moved back to their original channel.`,
                    components: []
                });
                
                buttonCollector?.stop();
            }
        });

        buttonCollector?.on('end', () => {
            if (isPlaying) {
                // Remove buttons when collector expires
                interaction.editReply({
                    content: `🎵 Playing "${soundName}" for ${targetUser.displayName} in Sabris Keller!`,
                    components: []
                }).catch(() => {});
            }
        });

        // Wait for the audio to finish
        await new Promise<void>((resolve) => {
            player!.on(AudioPlayerStatus.Idle, () => {
                if (isPlaying) {
                    resolve();
                }
            });

            player!.on('error', (error) => {
                console.error('Audio player error:', error);
                if (isPlaying) {
                    resolve();
                }
            });

            // Fallback timeout in case the audio doesn't end properly
            setTimeout(() => {
                if (isPlaying) {
                    resolve();
                }
            }, 30000); // 30 second max
        });

        if (isPlaying) {
            // Remove voice state listener
            interaction.client.removeAllListeners('voiceStateUpdate');

            // Move user back to original channel (if they're still in the temp channel)
            const currentMember = await interaction.guild.members.fetch(targetUser.id);
            if (currentMember.voice.channel?.id === tempChannel.id) {
                await currentMember.voice.setChannel(originalVoiceChannel);
            }

            // Disconnect from voice channel
            connection.destroy();

            // Delete the temporary channel
            await tempChannel.delete();

            isPlaying = false;
            buttonCollector?.stop();

            await interaction.followUp({
                content: `✅ Sabrify complete! ${targetUser.displayName} has been moved back to their original channel.`,
                flags: "Ephemeral"
            });
        }

    } catch (error) {
        console.error('Error in sabrify command:', error);
        isPlaying = false;

        // Remove voice state listener
        interaction.client.removeAllListeners('voiceStateUpdate');

        // Clean up temporary channel if it was created
        if (tempChannel) {
            try {
                // Move user back if they're still in temp channel
                const currentMember = await interaction.guild.members.fetch(targetUser.id);
                if (currentMember.voice.channel?.id === tempChannel.id) {
                    await currentMember.voice.setChannel(originalVoiceChannel);
                }
                await tempChannel.delete();
            } catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError);
            }
        }

        // Clean up voice connection
        if (connection) {
            connection.destroy();
        }

        buttonCollector?.stop();

        await interaction.editReply({
            content: `❌ An error occurred while executing the sabrify command: ${error instanceof Error ? error.message : 'Unknown error'}`,
            components: []
        });
    }
};