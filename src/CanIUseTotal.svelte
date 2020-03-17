<script>
  import { onMount } from "svelte";
  export let type;

  let full = 0;
  let partial = 0;

  onMount(async () => {
    const response = await fetch(
      "https://raw.githubusercontent.com/Fyrd/caniuse/master/fulldata-json/data-2.0.json"
    );
    const json = await response.json();
    const data = json.data;

    const typeData = data[type];
    if (!typeData) {
      return;
    }

    full = typeData.usage_perc_y;
    partial = typeData.usage_perc_a;
  });
</script>

<style>
  .y {
    color: #39b54a;
  }

  .p {
    color: #a8bd04;
  }

  p {
    margin: 0;
  }
</style>

<svelte:options tag={null} />
<p>
  <span class="y">{full}%</span>
  +
  <span class="p">{partial}%</span>
  = {Math.round((full + partial) * 100) / 100}%
</p>
