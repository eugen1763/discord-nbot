
export const COMMAND_DEFINITIONS = [
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
    },
    {
        name: "niggify",
        description: "Play a sound in a user's voice channel",
        options: [
            {
                name: "user",
                type: 6, // User
                description: "The user whose voice channel to join",
                required: true
            },
            {
                name: "soundname",
                type: 3, // String
                description: "The name of the sound to play",
                required: true
            }
        ]
    }
];