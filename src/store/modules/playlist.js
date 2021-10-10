import { markRaw, toRaw } from "vue"
import API from '/src/api'
import Disk from '/src/disk'

const reset = (state) => {
	state.name = null;
	state.tracks = markRaw([]);
	state.currentTrack = null;
	state.playbackOrder = "default";
	state.elapsedSeconds = 0;
	state.advancedInPlace = false; // Used internally to keep track of advance() action outcome
	state.enableRj = false;
	state.RjName = "Ameen Sayani";
	state.RjProgram = "Geetmala";
	return state;
}

const state = reset({});

class AnnouncementTrack {
	constructor(state) {
		if (!this.hasOwnProperty('path_counter')) {
			this.path_counter = 0;
		}

		this.path_counter = this.path_counter + 1;
		var announcement = {
			title: 'announcement',
			artist: state.RjName,
			album_artist: state.RjName,
			album: state.RjProgram,
			isAnnouncement: true,
			genre: 'vocal',
			path: state.RjProgram + '_' + this.path_counter,
		};
		return announcement;
	}
}

// If RJ service is enabled and requested then inserts announcements in the current playlist
// while queuing new tracks.
// TODO: Add logic to check if RJ service is enabled. This may need to ask the server for the
// config.
const insertAnnouncements = (state, tracks) => {
	if (state.enableRj == false) {
		return state.tracks.concat(tracks);
	}
	let copyTracks = [...state.tracks].concat(tracks);
	for (let i in copyTracks) {
		if (!copyTracks[i].hasOwnProperty('isAnnouncement')) {
			copyTracks[i].isAnnouncement = false;
		}
	}
	// We iterate one more element than length of array to see if we can end the
	// playlist with an announcement.
	for (let i = 1; i < copyTracks.length + 1; i = i + 4) {
		var announcement = new AnnouncementTrack(state);

		// If this index is already announcement then just update it.
		if (i < copyTracks.length && copyTracks[i].isAnnouncement == true) {
			announcement.prev = copyTracks[i - 1].path;
			if ((i + 1) < copyTracks.length) {
				announcement.next = copyTracks[i + 1].path;
			}
			if ((i + 2) < copyTracks.length) {
				announcement.next_next = copyTracks[i + 2].path;
			}
			copyTracks[i] = announcement;
		} else {
			announcement.prev = copyTracks[i - 1].path;
			if (i < copyTracks.length) {
				announcement.next = copyTracks[i].path;
			}
			if ((i + 1) < copyTracks.length) {
				announcement.next_next = copyTracks[i + 1].path;
			}
			// insert announcement.
			copyTracks.splice(i, 0, announcement);
		}
	}

	return copyTracks;
}

const getters = {}

const actions = {
	clear({ commit, dispatch }) {
		commit("clear");
		dispatch("savePlaylist");
	},

	shuffle({ commit, dispatch }) {
		commit("shuffle");
		dispatch("savePlaylist");
	},

	removeTrack({ commit, dispatch }, track) {
		commit("removeTrack", track);
		dispatch("savePlaylist");
	},

	setPlaybackOrder({ commit, dispatch }, order) {
		commit("setPlaybackOrder", order);
		dispatch("savePlaybackState");
	},

	setEnableRj({ commit, dispatch }, enable) {
		commit("setEnableRj", enable);
		dispatch("savePlaybackState");
	},

	setName({ commit, dispatch }, name) {
		commit("setName", name);
		dispatch("savePlaylist");
	},

	setElapsedSeconds({ commit, dispatch }, seconds) {
		commit("setElapsedSeconds", seconds);
		dispatch("savePlaybackState");
	},

	play({ commit, dispatch }, track) {
		commit("play", track);
		dispatch("savePlaybackState");
	},

	next({ commit, dispatch }) {
		commit("advance", 1);
		dispatch("savePlaybackState");
		return new Promise((resolve, reject) => resolve(state.advancedInPlace));
	},

	previous({ commit, dispatch }) {
		commit("advance", -1);
		dispatch("savePlaybackState");
		return new Promise((resolve, reject) => resolve(state.advancedInPlace));
	},

	queueTracks({ commit, dispatch }, tracks) {
		commit("queueTracks", tracks);
		dispatch("savePlaylist");
	},

	queueDirectory({ commit, dispatch }, path) {
		API.flatten(path)
			.then(items => {
				commit("queueTracks", items);
				dispatch("savePlaylist");
			});
	},

	queuePlaylist({ commit, dispatch }, name) {
		API.getPlaylist(name).then(data => {
			commit("clear");
			commit("queueTracks", data);
			commit("setName", name);
			dispatch("savePlaylist");
		});
	},

	savePlaylist({ dispatch }) {
		if (Disk.save("playlist", state.tracks)) {
			Disk.save("playlistName", state.name);
			dispatch("savePlaybackState");
		}
	},

	savePlaybackState() {
		let currentTrackIndex = state.tracks.indexOf(state.currentTrack);
		Disk.save("currentTrackIndex", currentTrackIndex);
		Disk.save("playbackOrder", state.playbackOrder);
		Disk.save("elapsedSeconds", state.elapsedSeconds);
		Disk.save("enableRj", state.enableRj);
	}
}


const mutations = {

	clear(state) {
		state.tracks = markRaw([]);
		state.name = null;
	},

	shuffle(state) {
		let shuffled = [...state.tracks];
		for (let i = shuffled.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		state.tracks = markRaw(shuffled);
	},

	queueTracks(state, tracks) {
		state.tracks = markRaw(insertAnnouncements(state, tracks));
		if (!state.currentTrack && state.tracks.length > 0) {
			state.currentTrack = state.tracks[0];
		}
	},

	removeTrack(state, track) {
		const trackIndex = state.tracks.indexOf(track);
		if (trackIndex >= 0) {
			let newTracks = [...state.tracks];
			newTracks.splice(trackIndex, 1);
			state.tracks = markRaw(newTracks);
		}
	},

	setPlaybackOrder(state, order) {
		state.playbackOrder = order;
	},

	setEnableRj(state, enable) {
		state.enableRj = enable;
	},

	setName(state, name) {
		state.name = name;
	},

	setElapsedSeconds(state, seconds) {
		state.elapsedSeconds = seconds;
	},

	play(state, track) {
		if (track != state.currentTrack) {
			state.currentTrack = track;
			state.elapsedSeconds = 0;
		}
	},

	advance(state, delta) {
		state.advancedInPlace = false;

		const playbackOrder = state.playbackOrder;
		const tracks = state.tracks;
		const numTracks = tracks.length;
		const currentTrack = state.currentTrack;

		let newTrack = null;
		if (numTracks > 0) {
			if (playbackOrder == "random") {
				const newTrackIndex = Math.floor(Math.random() * numTracks);
				newTrack = tracks[newTrackIndex];
			} else if (playbackOrder == "repeat-track") {
				newTrack = currentTrack;
			} else {
				const currentTrackIndex = tracks.indexOf(toRaw(currentTrack));
				if (currentTrackIndex < 0) {
					newTrack = tracks[0];
				} else {
					const newTrackIndex = currentTrackIndex + delta;
					if (newTrackIndex >= 0 && newTrackIndex < numTracks) {
						newTrack = tracks[newTrackIndex];
					} else if (playbackOrder == "repeat-all") {
						if (delta > 0) {
							newTrack = tracks[0];
						} else {
							newTrack = tracks[numTracks - 1];
						}
					}
				}
			}
		}

		if (newTrack != null) {
			state.advancedInPlace = newTrack == state.currentTrack;
			state.currentTrack = newTrack;
			state.elapsedSeconds = 0;
		}
	},

	loadFromDisk(state) {
		reset(state);
		let playbackOrder = Disk.load("playbackOrder");
		if (playbackOrder) {
			state.playbackOrder = playbackOrder;
		}
		let tracks = Disk.load("playlist");
		if (tracks) {
			state.tracks = markRaw(tracks);
		}
		let currentTrackIndex = Disk.load("currentTrackIndex");
		if (currentTrackIndex && currentTrackIndex >= 0 && currentTrackIndex < state.tracks.length) {
			state.currentTrack = state.tracks[currentTrackIndex];
		}
		let elapsedSeconds = Disk.load("elapsedSeconds");
		if (state.currentTrack && elapsedSeconds) {
			state.elapsedSeconds = elapsedSeconds;
		}
		let enableRj = Disk.load("enableRj");
		if (enableRj) {
			state.enableRj = enableRj;
		}
		state.name = Disk.load("playlistName");
	}
}

export default {
	namespaced: true,
	state,
	getters,
	actions,
	mutations
}
