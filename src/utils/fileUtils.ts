import fs from 'fs';
import path from 'path';

export const ensureDirectoryExists = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

export const createSoundsDirectory = (): string => {
    const soundsDir = path.join(__dirname, '..', '..', 'sounds');
    ensureDirectoryExists(soundsDir);
    return soundsDir;
};
