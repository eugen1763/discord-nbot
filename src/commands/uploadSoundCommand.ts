import { ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SoundManager } from '../soundManager';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export const handleUploadSoundCommand = async (
    interaction: ChatInputCommandInteraction,
    soundManager: SoundManager,
    soundsDir: string
): Promise<void> => {
    try {
        const soundName = interaction.options.getString('name', true);
        const attachment = interaction.options.getAttachment('file', true);

        // Validate file type
        const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
        const fileExtension = path.extname(attachment.name).toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            await interaction.reply({
                content: `❌ Invalid file type! Supported formats: ${allowedExtensions.join(', ')}`,
                ephemeral: true
            });
            return;
        }

        // Check file size (Discord limit is 25MB for regular users, 100MB for Nitro)
        const maxSize = 25 * 1024 * 1024; // 25MB in bytes
        if (attachment.size > maxSize) {
            await interaction.reply({
                content: '❌ File too large! Maximum size is 25MB.',
                ephemeral: true
            });
            return;
        }

        // Check if sound name already exists
        if (soundManager.soundExists(soundName)) {
            await interaction.reply({
                content: `❌ Sound "${soundName}" already exists! Use a different name or delete the existing sound first.`,
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();

        // Download and save the file
        const fileName = `${soundName}${fileExtension}`;
        const filePath = path.join(soundsDir, fileName);

        await downloadFile(attachment.url, filePath);

        await interaction.editReply({
            content: `✅ Successfully uploaded sound "${soundName}"! You can now play it with other commands.`
        });

    } catch (error) {
        console.error('Error uploading sound:', error);
        
        const errorMessage = '❌ Failed to upload sound file. Please try again.';
        
        if (interaction.deferred) {
            await interaction.editReply({ content: errorMessage });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
};

const downloadFile = (url: string, filePath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }

            const fileStream = fs.createWriteStream(filePath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });

            fileStream.on('error', (error) => {
                fs.unlink(filePath, () => {}); // Delete incomplete file
                reject(error);
            });
        }).on('error', reject);
    });
};