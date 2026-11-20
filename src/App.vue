<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("HandyReader Launch");
});

onShow(() => {
  console.log("HandyReader Show");
});

onHide(() => {
  console.log("HandyReader Hide");
});
</script>

<style>
@import "@/styles/theme.css";
@import "@/styles/animations.css";
</style>
