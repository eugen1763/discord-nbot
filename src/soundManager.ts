import fs from 'fs';
import path from 'path';

export class SoundManager {
    private soundsDir: string;

    constructor() {
        this.soundsDir = path.join(__dirname, '..', 'sounds');
        this.ensureSoundsDirectory();
    }

    private ensureSoundsDirectory(): void {
        if (!fs.existsSync(this.soundsDir)) {
            fs.mkdirSync(this.soundsDir, { recursive: true });
        }
    }

    public getAllSounds(): string[] {
        try {
            const files = fs.readdirSync(this.soundsDir);
            return files
                .filter(file => file.endsWith('.mp3') || file.endsWith('.mp4'))
                .map(file => path.basename(file, path.extname(file)));
        } catch (error) {
            console.error('Error reading sounds directory:', error);
            return [];
        }
    }

    public getSoundPath(name: string): string | null {
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Check for both .mp3 and .mp4 extensions
        const mp3Path = path.join(this.soundsDir, `${sanitizedName}.mp3`);
        const mp4Path = path.join(this.soundsDir, `${sanitizedName}.mp4`);
        
        if (fs.existsSync(mp3Path)) return mp3Path;
        if (fs.existsSync(mp4Path)) return mp4Path;
        
        return null;
    }

    public soundExists(name: string): boolean {
        return this.getSoundPath(name) !== null;
    }

    public deleteSound(name: string): boolean {
        const filePath = this.getSoundPath(name);
        if (filePath) {
            try {
                fs.unlinkSync(filePath);
                return true;
            } catch (error) {
                console.error('Error deleting sound:', error);
                return false;
            }
        }
        return false;
    }

    public getSoundInfo(name: string): { name: string; path: string; size: number; format: string } | null {
        const filePath = this.getSoundPath(name);
        if (filePath) {
            try {
                const stats = fs.statSync(filePath);
                const format = path.extname(filePath).substring(1).toUpperCase();
                return {
                    name,
                    path: filePath,
                    size: stats.size,
                    format
                };
            } catch (error) {
                console.error('Error getting sound info:', error);
                return null;
            }
        }
        return null;
    }
}