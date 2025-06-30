
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { SoundManager } from '../soundManager';

export const handleAddSoundCommand = async (
    interaction: ChatInputCommandInteraction,
    soundManager: SoundManager,
    soundsDir: string
): Promise<void> => {
    const name = interaction.options.getString('name', true);
    const youtubeUrl = interaction.options.getString('url', true);

    // Validate YouTube URL
    if (!ytdl.validateURL(youtubeUrl)) {
        await interaction.reply({
            content: '❌ Invalid YouTube URL provided!',
            ephemeral: true
        });
        return;
    }

    // Check if sound already exists
    if (soundManager.soundExists(name)) {
        await interaction.reply({
            content: `❌ A sound with the name "${name}" already exists!`,
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    try {
        // Get video info
        const info = await ytdl.getInfo(youtubeUrl);
        const videoTitle = info.videoDetails.title;

        // Create embed for progress
        const progressEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎵 Downloading Sound')
            .setDescription(`**Name:** ${name}\n**Video:** ${videoTitle}\n**Status:** Starting download...`)
            .setTimestamp();

        await interaction.editReply({ embeds: [progressEmbed] });

        // Sanitize filename and create path
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filePath = path.join(soundsDir, `${sanitizedName}.mp3`);

        // Update progress
        const downloadingEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎵 Downloading Sound')
            .setDescription(`**Name:** ${name}\n**Video:** ${videoTitle}\n**Status:** Downloading audio...`)
            .setTimestamp();

        await interaction.editReply({ embeds: [downloadingEmbed] });

        // Create download stream
        const stream = ytdl(youtubeUrl, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });

        const writeStream = fs.createWriteStream(filePath);

        // Handle stream events
        stream.pipe(writeStream);

        // Track download progress
        let downloadedBytes = 0;
        const contentLength = parseInt(info.formats.find(format => 
            format.hasAudio && !format.hasVideo
        )?.contentLength || '0');

        stream.on('progress', async (chunkLength, downloaded, total) => {
            downloadedBytes = downloaded;
            const percent = Math.round((downloaded / total) * 100);
            
            // Update progress every 25% to avoid rate limiting
            if (percent % 25 === 0) {
                const progressEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🎵 Downloading Sound')
                    .setDescription(`**Name:** ${name}\n**Video:** ${videoTitle}\n**Progress:** ${percent}%`)
                    .setTimestamp();

                try {
                    await interaction.editReply({ embeds: [progressEmbed] });
                } catch (error) {
                    // Ignore edit errors (rate limiting)
                }
            }
        });

        writeStream.on('finish', async () => {
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Sound Added Successfully')
                .setDescription(`**Name:** ${name}\n**Video:** ${videoTitle}\n**File:** ${sanitizedName}.mp3`)
                .addFields(
                    { name: 'File Size', value: `${Math.round(fs.statSync(filePath).size / 1024)} KB`, inline: true },
                    { name: 'Duration', value: info.videoDetails.lengthSeconds ? `${Math.floor(parseInt(info.videoDetails.lengthSeconds) / 60)}:${(parseInt(info.videoDetails.lengthSeconds) % 60).toString().padStart(2, '0')}` : 'Unknown', inline: true }
                )
                .setFooter({ text: 'You can now use this sound in your bot!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });
        });

        writeStream.on('error', async (error) => {
            console.error('Error writing file:', error);
            
            // Clean up partial file
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (cleanupError) {
                    console.error('Error cleaning up partial file:', cleanupError);
                }
            }

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Download Failed')
                .setDescription(`Failed to save the audio file: ${error.message}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        });

        stream.on('error', async (error) => {
            console.error('Error downloading:', error);
            
            // Clean up partial file
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (cleanupError) {
                    console.error('Error cleaning up partial file:', cleanupError);
                }
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Download Failed')
                .setDescription(`Failed to download audio: ${error.message}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        });

    } catch (error) {
        console.error('Error in addSound command:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Error')
            .setDescription(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
};