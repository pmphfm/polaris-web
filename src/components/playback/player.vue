<template>
	<div class="player">
		<audio ref="htmlAudio" controls v-bind:src="trackURL" v-on:timeupdate="onTimeUpdate" v-on:error="onPlaybackError" v-on:ended="skipNext" v-on:pause="onPaused" v-on:playing="onPlaying"></audio>

		<div v-if="currentTrack" class="controls noselect">
			<div class="playback">
				<div class="control previous" v-on:click="skipPrevious">
					<i class="material-icons md-18">skip_previous</i>
				</div>
				<div v-if="paused" class="control play" v-on:click="togglePlay">
					<i class="material-icons">play_arrow</i>
				</div>
				<div v-if="!paused" class="control pause" v-on:click="togglePlay">
					<i class="material-icons">pause</i>
				</div>
				<div class="control next" v-on:click="skipNext">
					<i class="material-icons md-18">skip_next</i>
				</div>
			</div>
			<div class="volume">
				<div class="icon" v-on:click="toggleMute">
					<i v-if="volume == 0" class="material-icons">volume_off</i>
					<i v-if="volume > 0" class="material-icons">volume_down</i>
				</div>
				<div class="bar" ref="volumeInput" v-on:mousedown="volumeMouseDown">
					<div class="fill" v-bind:style="{ width: 100 * volume + '%' }"></div>
				</div>
			</div>
		</div>

		<div v-if="currentTrack" class="art">
			<cover-art v-if="artworkURL" v-bind:url="artworkURL"></cover-art>
			<div v-if="!artworkURL" class="missing-art"></div>
		</div>

		<div class="currentTrack" v-if="currentTrack">
			<div class="trackInfo">
				<div class="primary">{{ trackInfoPrimary }}</div>
				<div class="secondary">{{ trackInfoSecondary }}</div>
			</div>
			<div class="seekBar" ref="seekInput" v-on:mousedown="seekMouseDown">
				<div class="fill" v-bind:style="{ width: 100 * trackProgress + '%' }"></div>
				<div class="head" v-bind:style="{ left: 100 * trackProgress + '%' }"></div>
			</div>
			<div v-if="currentTrack" class="trackDuration">{{ formattedPlaybackTime }}</div>
			<div class="trackInfo">
				<div class="detailed" v-html="trackInfoDetailed"></div>
			</div>
		</div>
	</div>
</template>


<script>
import { nextTick } from "vue";
import { mapState } from "vuex";
import API from "/src/api";
import Disk from "/src/disk";
import * as Format from "/src/format";
import notify from "/src/notify";
import CoverArt from "/src/components/cover-art";
export default {
	components: {
		"cover-art": CoverArt,
	},

	data() {
		return {
			volume: 1,
			unmutedVolume: 1,
			secondsPlayed: 0,
			duration: 1,
			mouseDown: false,
			adjusting: null,
			paused: true,
			canScrobble: false,
		};
	},

	computed: {
		...mapState(["playlist"]),

		currentTrack: function () {
			return this.playlist.currentTrack;
		},

		trackURL: function () {
			if (!this.currentTrack) {
				return null;
			}
			if (this.currentTrack.isAnnouncement) {
			  return API.makeAnnouncementURL(this.currentTrack.prev , this.currentTrack.next,
				    this.currentTrack.next_next);
			}
			return API.makeAudioURL(this.currentTrack.path);
		},

		artworkURL: function () {
			if (!this.currentTrack || !this.currentTrack.artwork) {
				return null;
			}
			return API.makeThumbnailURL(this.currentTrack.artwork);
		},

		formattedPlaybackTime: function () {
			return Format.duration(this.secondsPlayed);
		},

		trackProgress: function () {
			if (isNaN(this.duration)) {
				return 0;
			}
			if (this.duration == 0) {
				return 1;
			}
			return this.secondsPlayed / this.duration;
		},

		trackInfoPrimary() {
			const track = this.currentTrack;
			let result = track.artist ? track.artist : "Unknown Artist";
			result += " - ";
			result += Format.title(track);
			return result;
		},

		trackInfoSecondary() {
			const track = this.currentTrack;
			let result = track.album || "Unknown Album";
			if (track.year) {
				result += " (" + track.year + ")";
			}
			if (track.track_number) {
				result += " #" + track.track_number;
			}
			return result;
		},
		trackInfoDetailed() {
			const track = this.currentTrack;
			let result = "";
			if (track.title) {
				result += "<b>Title:</b>" + track.title + " ";
			}
			if (track.album) {
				result += "<b>Album:</b>" + track.album + " ";
			}
			if (track.artist) {
				result += "<b>Artist:</b>" + track.artist + " ";
			}
			if (track.composer) {
				result += "<b>Composer:</b>" + track.composer + " ";
			}
			if (track.lyricist) {
				result += "<b>Lyricist:</b>" + track.lyricist + " ";
			}
			if (track.genre) {
				result += "<b>Genre:</b>" + track.genre + " ";
			}
			if (track.album_artist) {
				result += "<b>Album Artist:</b>" + track.album_artist + " ";
			}

			if (track.year) {
				result += "<br><b>Year:</b>" + track.year + " ";
			}
			if (track.category) {
				result += "<b>Category:</b>" + track.category + " ";
			}
			if (track.copyright) {
				result += "<b>Label:</b>" + track.copyright + " ";
			}
			if (track.track_number) {
				result += "<b>Track:</b>" + track.track_number + " ";
			}
			if (track.disc_number) {
				result += "<b>Disc:</b>" + track.disc_number + " ";
			}
			if (track.duration) {
				result += "<b>Duration:</b>" + track.duration + " ";
			}
			return result;
		},
	},

	watch: {
		currentTrack(to, from) {
			if (this.invalid) {
				return;
			}
			this.handleCurrentTrackChanged();
			this.beginPlay();
		},

		volume(to, from) {
			this.$refs.htmlAudio.volume = to;
			Disk.save("volume", to);
		},
	},

	beforeUnmount() {
		this.invalid = true;
	},

	mounted() {
		const volume = parseFloat(Disk.load("volume"));
		if (!isNaN(volume)) {
			this.volume = volume;
			if (volume > 0) {
				this.unmutedVolume = volume;
			}
		}

		if (this.playlist.currentTrack) {
			this.handleCurrentTrackChanged();
		}

		if (this.playlist.elapsedSeconds && this.playlist.elapsedSeconds > 0) {
			this.seekTo(this.playlist.elapsedSeconds);
		}

		if (navigator.mediaSession && navigator.mediaSession.setActionHandler) {
			navigator.mediaSession.setActionHandler("previoustrack", this.skipPrevious);
			navigator.mediaSession.setActionHandler("nexttrack", this.skipNext);
		}

		// Global mouse handling
		let onMouseMove = event => {
			if (event.buttons != undefined) {
				const isLeftClickDown = (event.buttons & 1) == 1;
				if (!isLeftClickDown) {
					return;
				}
			}
			if (this.adjusting == "volume") {
				this.volumeMouseMove(event);
			} else if (this.adjusting == "seek") {
				this.seekMouseMove(event);
			}
		};

		document.body.addEventListener("mousemove", onMouseMove);
		document.body.addEventListener("mousedown", event => {
			onMouseMove(event);
		});
		document.body.addEventListener("mouseup", () => {
			if (this.adjusting == "volume" && this.volume != 0) {
				this.unmutedVolume = this.volume;
			}
			this.adjusting = null;
		});
	},

	methods: {
		handleCurrentTrackChanged() {
			if (this.adjusting == "seek") {
				this.adjusting = null;
			}
			this.canScrobble = true;
			this.updateMediaSession();
			this.updateWindowTitle();
			API.lastFMNowPlaying(this.currentTrack.path);
		},

		beginPlay() {
			nextTick(() => {
				this.$refs.htmlAudio
					.play()
					.then(() => {
						this.$refs.htmlAudio.currentTime = 0;
					});
			});
		},

		updateMediaSession() {
			if (navigator.mediaSession && MediaMetadata) {
				const track = this.currentTrack;
				let metadata = new MediaMetadata({
					title: track.title,
					artist: track.artist,
					album: track.album,
				});
				if (this.artworkURL) {
					metadata.artwork = [{ src: this.artworkURL }];
				}
				navigator.mediaSession.metadata = metadata;
			}
		},

		updateWindowTitle() {
			const track = this.currentTrack;
			let windowTitle = track.artist ? track.artist : "Unknown Artist";
			windowTitle += " - ";
			windowTitle += Format.title(track);
			document.title = windowTitle;
		},

		toggleMute() {
			if (this.volume != 0) {
				this.volume = 0;
			} else {
				this.volume = this.unmutedVolume;
			}
		},

		togglePlay() {
			if (this.$refs.htmlAudio.paused) {
				this.$refs.htmlAudio.play();
			} else {
				this.$refs.htmlAudio.pause();
			}
		},

		skipPrevious() {
			this.$store.dispatch("playlist/previous")
			.then(advancedInPlace => {
				if (advancedInPlace) {
					this.handleCurrentTrackChanged();
					this.beginPlay();
				}
			});
		},

		skipNext() {
			this.$store.dispatch("playlist/next")
			.then(advancedInPlace => {
				if (advancedInPlace) {
					this.handleCurrentTrackChanged();
					this.beginPlay();
				}
			});
		},

		updateScrobble() {
			if (this.canScrobble) {
				const shouldScrobble = this.duration > 30 && (this.trackProgress > 0.5 || this.secondsPlayed > 4 * 60);
				if (shouldScrobble) {
					API.lastFMScrobble(this.currentTrack.path);
					this.canScrobble = false;
				}
			}
		},

		seekMouseDown() {
			this.adjusting = "seek";
		},

		volumeMouseDown() {
			this.adjusting = "volume";
		},

		seekMouseMove(event) {
			if (this.adjusting == "seek") {
				let x = event.pageX;
				let o = this.$refs.seekInput;
				while (o) {
					x -= o.offsetLeft;
					o = o.offsetParent;
				}
				let progress = Math.min(Math.max(x / this.$refs.seekInput.offsetWidth, 0), 1);
				this.seekTo(progress * this.duration);
			}
		},

		seekTo(elapsedSeconds) {
			this.$refs.htmlAudio.currentTime = elapsedSeconds;
			this.canScrobble = false;
		},

		volumeMouseMove(event) {
			if (this.adjusting == "volume") {
				let x = event.pageX;
				let o = this.$refs.volumeInput;
				while (o) {
					x -= o.offsetLeft;
					o = o.offsetParent;
				}
				this.volume = Math.min(Math.max(x / this.$refs.volumeInput.offsetWidth, 0), 1);
			}
		},

		onPaused(event) {
			this.paused = event.target.paused;
		},

		onPlaying(event) {
			this.paused = event.target.paused;
		},

		onTimeUpdate(event) {
			if (this.invalid) {
				return;
			}
			const htmlAudio = event.target;
			const currentTime = htmlAudio.currentTime;
			const duration = htmlAudio.duration || 1;
			this.secondsPlayed = currentTime;
			this.duration = duration;
			if (navigator.mediaSession && navigator.mediaSession.setPositionState) {
				navigator.mediaSession.setPositionState({
					position: currentTime,
					duration: duration,
					playbackRate: 1,
				});
			}
			this.$store.dispatch("playlist/setElapsedSeconds", currentTime);
			this.updateScrobble();
		},

		onPlaybackError(event) {
			const errorText = "'" + this.trackInfoPrimary + "' could not be played because ";
			const artwork = this.artworkURL || null;
			const error = event.target.error;
			switch (error.code) {
				case error.MEDIA_ERR_NETWORK:
					notify("Playback Error", artwork, errorText + "of a network error.");
					break;
				case error.MEDIA_ERR_DECODE:
					notify("Playback Error", artwork, errorText + "of a decoding error.");
					break;
				case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
					notify("Playback Error", artwork, errorText + "it is not a suitable source of audio.");
					break;
				default:
					console.log("Unexpected playback error: " + error.code);
					break;
			}
			this.paused = true;
			this.skipNext();
		},
	},
};
</script>

<style scoped>
.player {
	padding: 40px;
	display: flex;
	flex-flow: row nowrap;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

audio {
	display: none;
}

.art {
	width: 120px;
	height: 120px;
	position: relative;
}

.missing-art {
	height: 100%;
	border-radius: 5px;
	background: repeating-linear-gradient(-45deg, var(--theme-background-muted), var(--theme-background-muted) 8px, var(--theme-background) 8px, var(--theme-background) 16px);
}

.currentTrack {
	flex-grow: 1;
	padding-left: 20px;
}

.controls {
	margin-right: 20px;
	width: 120px;
	cursor: default;
}

.controls .playback {
	display: flex;
	flex-flow: row nowrap;
	justify-content: space-between;
	align-items: center;
}

.control {
	border-radius: 50%;
	border: 1px solid var(--theme-border);
	text-align: center;
}

.control.previous,
.control.next {
	width: 28px;
	height: 28px;
	line-height: 28px;
	padding-top: 4px;
	box-sizing: border-box;
}

.control.play,
.control.pause {
	padding-top: 6px;
	width: 40px;
	height: 40px;
	line-height: 40px;
	box-sizing: border-box;
}

.volume {
	margin-left: -4px;
	display: flex;
	flex-flow: row nowrap;
}

.volume .bar {
	flex-grow: 1;
	background-color: var(--theme-foreground-muted);
	height: 10px;
	margin: 7px 0;
	border-radius: 3px;
}

.volume .fill {
	height: 100%;
	max-width: 100%;
	background-color: var(--theme-accent);
	border-radius: 3px;
}

.trackInfo .primary {
	font-weight: 600;
	margin-bottom: -5px;
}

.trackInfo .secondary,
.trackDuration {
	font-weight: 300;
	font-size: 0.875rem;
}

.trackInfo .detailed {
	font-weight: bold;
	font-size: 0.875rem;
}
.seekBar {
	width: 100%;
	background-color: var(--theme-foreground-muted);
	height: 10px;
	margin: 6px 0;
	border-radius: 3px;
}

.seekBar .fill {
	height: 100%;
	width: 0;
	max-width: 100%;
	background-color: var(--theme-accent);
	border-radius: 3px;
}

.seekBar .head {
	width: 16px;
	height: 16px;
	position: relative;
	top: -14px;
	margin-left: -9px;
	background-color: var(--theme-background);
	border: 1px solid var(--theme-border);
	border-radius: 3px;
}

.controls,
.art img,
.currentTrack {
	animation-duration: 250ms;
	animation-name: fadein;
}

@keyframes fadein {
	from {
		margin-top: 100px;
		transform: scale(0);
		opacity: 0;
	}
	to {
		margin-top: 0;
		transform: scale(1);
		opacity: 1;
	}
}
</style>
