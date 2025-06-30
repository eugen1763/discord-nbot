
export const COMMAND_DEFINITIONS = [
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
];