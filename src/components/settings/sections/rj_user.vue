<template>
  <div class="main_div">
    <div class="explanation">
      Polaris can play songs in radio-jockey(rj) mode wherein it can announce previous and upto two
      upcoming song details. Provided the songs are properly tagged, this information can include
      artist, lyricist to label and genre. The announcement is picked randomly and can be
      concatenated. Announcement is as good as the user writes the script. A fully working
      announcement script is here.

      <ul class="bullet_points">A tutorial example can be found <a href="https://github.com/pmphfm/polaris-android/commits/master"> here</a>. </ul>
      <ul class="bullet_points">A default script for english RJ can be found <a href=”https://github.com/pmphfm/polaris-android/commits/master”>here</a>. </ul>

      <b>Note:</b>
      <ul class="bullet_points"> These options are controlled only by the admin. In future users can control this.</ul>
      <ul class="bullet_points"> RJ mode does not work well when shuffle mode is turned on.</ul>
      <ul class="bullet_points"> RJ mode does not work well when songs are inserted and removed from the middle of playlist.</ul>
    </div>

    <form class="field" v-if="rj_user" v-on:submit.prevent>
      <div class="field">
        <div>
          <label for="enable_by_default">Enable by default</label>
          <input type="checkbox" id="enable_by_default" v-model="rj_user.enable_by_default" />
          <p class="tip">
            When enabled, turns on RJ mode by default on all new clients (unless the client
            overrides it in the player window).
          </p>
        </div>

        <label for="rj_name">Rj Name</label>
        <input type="text" id="rj_name" v-model="rj_user.tts_people[0].name" placeholder="url" />
        <p class="tip">RJ Name.</p>

        <label for="voice_model">Voice Model</label>
        <input type="text" id="voice_model" v-model="rj_user.tts_people[0].voice_model" />
        <p class="tip">Voice model</p>

        <label for="rj_language">RJ language</label>
        <input type="text" id="rj_language" v-model="rj_user.tts_people[0].language" />
        <p class="tip">RJ Language</p>

        <label for="scripts">Scripts</label>
        <textarea class="script_text" type="text" id="scripts" :disabled="is_admin == false" v-model="rj_user.scripts" placeholder="url" />
        <p class="tip">
          The script defines all the possible announcement patterns. One can be creative in writing
          the script to make it more interesting and random.
          The URL pointing to your Polaris server
        </p>
        <input type="submit" value="Save" v-on:click="commit" />
        <div class="error" v-if="save_error != null">error is {{ save_error }}</div>
      </div>
    </form>
  </div>
</template>

<script>
import API from "/src/api";
export default {
	data() {
		return {
			rj_user: null,
			save_error: null,
			is_admin: false,
		};
	},

	mounted() {
		API.getRjUserSettings().then(data => {
			this.rj_user = data;
			this.is_admin = this.$store.getters["user/isAdmin"];
			this.save_error = null;
			if (!this.rj_user.hasOwnProperty("tts_people") || this.rj_user.tts_people.length == 0) {
				var empty_person = [
					{
						name: "",
						voice_model: "",
						language: "",
					},
				];
				this.rj_user.tts_people = empty_person;
			}
			console.log("hello" + JSON.stringify( this.rj_user));
		});
	},

	methods: {
		async commit() {
			var res = await API.putRjUserSettings(this.rj_user);
			if (res.ok) {
				this.save_error = null;
				return;
			}
			var msg = await res.text();
			this.save_error = msg;
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

.script_text {
	background-color: var(--theme-background);
	width: 100%;
	height: 90%;
	padding-right: 10px;
}

.error {
	color: red;
}

.bullet_points {
	display: list-item;
	margin-left: 15px;
}

.field {
	width: 95%;
	height: 90%;
	padding: 10px;
	padding-left: 10px;
	padding-right: 10px;
	border-radius: 10px;
	background-color: var(--theme-background-muted);
}

.main_div {
	height: 90%;
}
</style>
