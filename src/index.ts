import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { Player } from 'discord-player';
import config from '../config.json';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { SoundManager } from './soundManager';

const client = new Client({
    intents: [
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize the player and sound manager
const player = new Player(client);
const soundManager = new SoundManager();

// Create sounds directory if it doesn't exist
const soundsDir = path.join(__dirname, '..', 'sounds');
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
}

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

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'addsound') {
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

    } else if (interaction.commandName === 'listsounds') {
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

    } else if (interaction.commandName === 'deletesound') {
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

    } else if (interaction.commandName === 'play') {
        // Your existing play command logic here
        const query = interaction.options.getString('query', true);
        // ... rest of play command
    }
});

client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!client.application?.owner) await client.application?.fetch();

    if (message.content === "!deploy" && message.author.id === client.application?.owner?.id) {
        await message.guild.commands.set([
            {
                name: "play",
                description: "Plays a song from youtube",
                options: [
                    {
                        name: "query",
                        type: 3, // String
                        description: "The song you want to play",
                        required: true
                    }
                ]
            },
            {
                name: "skip",
                description: "Skip to the current song"
            },
            {
                name: "stop",
                description: "Stop the player"
            },
            {
                name: "addsound",
                description: "Download and store an MP3 from YouTube",
                options: [
                    {
                        name: "name",
                        type: 3, // String
                        description: "Name to store the sound under",
                        required: true
                    },
                    {
                        name: "url",
                        type: 3, // String
                        description: "YouTube URL to download",
                        required: true
                    }
                ]
            },
            {
                name: "listsounds",
                description: "List all stored sounds"
            },
            {
                name: "deletesound",
                description: "Delete a stored sound",
                options: [
                    {
                        name: "name",
                        type: 3, // String
                        description: "Name of the sound to delete",
                        required: true
                    }
                ]
            }
        ]);

        await message.reply("Deployed!");
    }

    if (message.mentions.has(client.user!)) {
        await message.reply('Hi! You can use commands with the prefix "!"');
    }
});

client.login(config.token).then();