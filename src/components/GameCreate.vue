<template>
  <div class="bg-indigo-300 p-4">
    <h2 class="text-2xl">New Game</h2>
    <div class="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
      <div class="border-2 border-indigo-600 rounded p-4">
        <p class="text-xl pb-4">Invite somebody to play</p>

        <button class="bg-indigo-700 text-white px-4 py-2 rounded font-bold" @click="findUser()">Find User</button>

        <div v-if="contacts.length" class="py-4">
          <label for="contacts" class="block mb-2 text-sm font-medium text-gray-900">
            ... or choose from your contacts
          </label>
          <select
            id="contacts"
            v-model="userId"
            :size="Math.min(contacts.length + 1, 4)"
            class="bg-indigo-200 text-gray-600 border border-indigo-200 rounded-lg block w-full p-2.5"
          >
            <option v-for="contact in contacts" :key="contact.id" :value="contact.user.id" class="p-1">
              {{ contact.user.name }}
            </option>
          </select>
        </div>

        <div v-if="idSelected">
          <button class="bg-indigo-700 text-white px-4 rounded py-2 font-bold" @click="createGame()">
            Create Game with {{ user.name }}
          </button>
        </div>
      </div>

      <div class="border-2 border-indigo-600 rounded p-4">
        <p class="text-xl pb-4">Create a sharable link</p>
        <button class="bg-indigo-700 text-white px-4 py-2 rounded font-bold" @click="createLink()">Create Link</button>
        <div v-if="link" class="pt-4">
          <span class="pr-2 font-bold">{{ link }}</span>
          <button class="bg-indigo-700 text-white px-2 py-1 rounded" @click="copy(link)">Copy</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useBazaarStore } from "@/stores/bazaar";
import { bzr } from "@/bazaar";
import type { Contact } from "@bzr/bazaar";

const store = useBazaarStore();

const userId = ref("");
const idSelected = computed(() => userId.value.length == 36);
const user = ref({ name: "" });

watch(idSelected, async (hasID) => {
  if (hasID) {
    user.value = await bzr.social.getUser(userId.value);
  }
});

function createGame() {
  if (!userId.value) {
    console.log("specify userId");
    return;
  }
  store.createGame(userId.value).then(() => {
    userId.value = "";
  });
}

const contacts = ref([] as Contact[]);
bzr.social.contacts.list().then((c) => {
  contacts.value = c;
  console.log(c);
  bzr.social.contacts.subscribe((changes) => {
    if (!changes.oldDoc) {
      // New doc
      contacts.value.push(changes.newDoc as Contact);
      return;
    }
    if (!changes.newDoc) {
      // Deleted doc
      const idx = contacts.value.findIndex((doc) => doc.id === changes.oldDoc!.id);
      if (idx > -1) {
        contacts.value.splice(idx, 1);
      }
      return;
    }
    // Changed doc
    const idx = contacts.value.findIndex((doc) => doc.id === changes.newDoc!.id);
    contacts.value[idx] = changes.newDoc as Contact;
    return;
  });
});

function findUser() {
  bzr.social.openModal((uId) => {
    console.log(uId);
    userId.value = uId;
  });
}

const link = ref("");
function createLink() {
  store.createLink().then((url) => {
    link.value = url;
  });
}

function copy(link: string) {
  navigator.clipboard.writeText(link);
}
</script>
