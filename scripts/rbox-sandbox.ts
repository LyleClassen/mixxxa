import { MasterDb } from 'rbox-js'

const db = MasterDb.open();
const tracks = db.getPlaylistContents("1975418318");

for (const track of tracks) {
    console.log({
        id: track.id,
        title: track.title,
        artist: track.artistId,
        bpm: track.bpm,
        key: track.keyId,
        genre: track.genreId,
        length: track.length,
        rating: track.rating,
        djPlayCount: track.djPlayCount,
        bitrate: track.bitRate,
    });
}
console.log(`\nTotal tracks: ${tracks.length}`);
