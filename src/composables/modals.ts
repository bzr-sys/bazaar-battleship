import { useRoute } from "vue-router";
import { computed } from "vue";

const isModalOpen = computed(() => !!useRoute().meta.isDisplayedInModal);

export default {
  isModalOpen,
};
