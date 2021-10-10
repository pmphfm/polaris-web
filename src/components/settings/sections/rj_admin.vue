<template>
  <div>
    <div class="explanation">
      Polaris can play songs in radio-jockey(rj) mode wherein it can announce previous and upto two
      upcoming song details. Provided the songs are properly tagged, this information can include
      artist, lyricist to label and genre. The announcement is picked randomly and can be
      concatenated. Announcement is as good as the user writes the script. A fully working
      announcement script is here.

      See: Rj user settings.
    </div>

    <form v-if="rj_admin" v-on:submit.prevent>
      <div class="field">
        <label for="host">TTS server url</label>
        <input type="text" id="host" v-model="rj_admin.tts_url" v-on:change="commit" placeholder="url" />
        <p class="tip">The URL pointing to your Polaris server.</p>

        <label for="tts_key">TTS Text Param Key</label>
        <input type="text" id="tts_key" v-model="rj_admin.tts_key" v-on:change="commit" />
        <p class="tip">The field that carries announcement text to be converted into speech.</p>

        <label for="enable_ssml">Enable by SSML</label>
        <input type="checkbox" id="enable_ssml" v-model="rj_admin.enable_ssml" v-on:change="commit" />
        <p class="tip">
          Enable if the TTS service allows <a href="https://www.w3.org/TR/speech-synthesis11/">SSML</a>.
        </p>

      </div>
    </form>
  </div>
</template>

<script>
import API from "/src/api";
export default {
	data() {
		return {
			rj_admin: null,
		};
	},

	mounted() {
		API.getRjAdminSettings().then(data => {
			this.rj_admin = data;
		});
	},

	methods: {
		commit() {
			API.putRjAdminSettings(this.rj_admin);
		},
	},
};
</script>

<style scoped>
a {
	text-decoration: underline;
	color: var(--theme-accent);
}

.code {
	font-family: "Courier New", "sans-serif";
	color: inherit;
}
</style>
