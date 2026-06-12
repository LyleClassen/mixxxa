import { MasterDb } from 'rbox-js'

const db = MasterDb.open();
const tracks = db.getPlaylistContents("1975418318");
const songs = db.getPlaylistSongs("1975418318");
// const aSong = db.getCu
// console.log(aSong)
// for (const song of songs) {
//     console.log(song);
// }

// for (const track of tracks) {
//     console.log({
//         id: track.id,
//         title: track.title,
//         artist: track.artistId,
//         bpm: track.bpm,
//         key: track.keyId,
//         genre: track.genreId,
//         length: track.length,
//         rating: track.rating,
//         djPlayCount: track.djPlayCount,
//         bitrate: track.bitRate,
//     });
//     console.log(track);
// }
// console.log(`\nTotal tracks: ${tracks.length}`);
